using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;
using System.Windows.Threading;
using System.IO;
using System.Text;

namespace LightTodo.Widget
{
    public sealed class WidgetWindow : Window
    {
        private readonly StackPanel tasksPanel = new StackPanel();
        private readonly ScrollViewer taskScroll = new ScrollViewer();
        private readonly TextBox composer = new TextBox();
        private readonly TextBlock listLabel = new TextBlock();
        private readonly TextBlock countLabel = new TextBlock();
        private readonly Border errorBar = new Border();
        private readonly TextBlock errorText = new TextBlock();
        private readonly Popup listPopup = new Popup();
        private StackPanel listPopupItems = new StackPanel();
        private readonly StreamReader input = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
        private SnapshotDto snapshot;
        private TaskDto dragCandidate;
        private Point dragStart;
        private bool resizing;
        private Point resizeOrigin;
        private double resizeWidth;
        private bool shuttingDown;

        public WidgetWindow()
        {
            Title = "轻待办 · 原生贴片";
            WindowStyle = WindowStyle.None;
            AllowsTransparency = false;
            Background = Brushes.Transparent;
            Topmost = false;
            ShowInTaskbar = false;
            ShowActivated = false;
            ResizeMode = ResizeMode.NoResize;
            Width = 360;
            Height = 178;
            FontFamily = new FontFamily("Segoe UI, Microsoft YaHei");
            Foreground = GlassStyles.Text;
            NativeComposition.Prepare(this);
            BuildWindow();
            SourceInitialized += delegate
            {
                if (!NativeComposition.Configure(this))
                    Protocol.WriteEvent(new EventDto { Type = "error", Message = "当前系统无法启用原生玻璃合成" });
                Protocol.WriteEvent(new EventDto { Type = "ready" });
            };
            LocationChanged += delegate { listPopup.IsOpen = false; };
            Deactivated += delegate { listPopup.IsOpen = false; };
            Closing += delegate
            {
                if (!shuttingDown) Protocol.WriteEvent(new EventDto { Type = "hide" });
            };
            Dispatcher.BeginInvoke(new Action(ReadCommands), DispatcherPriority.Background);
        }

        private void BuildWindow()
        {
            var root = new Grid();
            root.PreviewMouseLeftButtonDown += BeginWindowDrag;
            var shell = new Border
            {
                CornerRadius = new CornerRadius(26),
                Background = GlassStyles.ShellBackground(),
                BorderBrush = GlassStyles.ShellEdgeBrush(),
                BorderThickness = new Thickness(1),
                Effect = GlassStyles.Shadow(),
            };
            var layout = new Grid { Margin = new Thickness(12, 14, 12, 12) };
            layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(52) });
            layout.RowDefinitions.Add(new RowDefinition());
            layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(60) });
            layout.Children.Add(BuildHeader());
            BuildTaskList(layout);
            layout.Children.Add(BuildComposer());
            BuildErrorBar(layout);
            shell.Child = layout;
            root.Children.Add(shell);

            var liquid = LiquidGlassLayer.Create();
            liquid.SetAnimationsEnabled(GlassStyles.MotionEnabled);
            root.Children.Add(liquid);
            var innerEdge = new Border
            {
                Margin = new Thickness(1),
                CornerRadius = new CornerRadius(25),
                BorderBrush = new SolidColorBrush(Color.FromArgb(58, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                IsHitTestVisible = false,
            };
            root.Children.Add(innerEdge);
            Content = root;
        }

        private FrameworkElement BuildHeader()
        {
            var header = new Grid();
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(20) });
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            header.ColumnDefinitions.Add(new ColumnDefinition());
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var grip = new TextBlock
            {
                Text = "⠿",
                Foreground = GlassStyles.SecondaryText,
                VerticalAlignment = VerticalAlignment.Center,
                Cursor = Cursors.SizeAll,
            };
            header.Children.Add(grip);

            var listButton = new Button
            {
                Style = GlassStyles.ButtonStyle(14),
                Height = 30,
                MinWidth = 92,
                MaxWidth = 160,
                Padding = new Thickness(10, 0, 10, 0),
                Content = listLabel,
            };
            listLabel.TextTrimming = TextTrimming.CharacterEllipsis;
            listButton.Click += delegate
            {
                BuildListPopup();
                listPopup.PlacementTarget = listButton;
                listPopup.Placement = PlacementMode.Bottom;
                listPopup.IsOpen = true;
            };
            Grid.SetColumn(listButton, 1);
            header.Children.Add(listButton);

            countLabel.Foreground = GlassStyles.SecondaryText;
            countLabel.FontSize = 10;
            countLabel.HorizontalAlignment = HorizontalAlignment.Right;
            countLabel.VerticalAlignment = VerticalAlignment.Center;
            Grid.SetColumn(countLabel, 2);
            header.Children.Add(countLabel);

            var open = MakeHeaderButton("↗", "打开主窗口");
            open.Click += delegate { Protocol.WriteEvent(new EventDto { Type = "openMain" }); };
            Grid.SetColumn(open, 3);
            header.Children.Add(open);
            var hide = MakeHeaderButton("×", "隐藏贴片");
            hide.Click += delegate { Protocol.WriteEvent(new EventDto { Type = "hide" }); };
            Grid.SetColumn(hide, 4);
            header.Children.Add(hide);
            return header;
        }

        private Button MakeHeaderButton(string text, string tooltip)
        {
            return new Button
            {
                Content = text,
                ToolTip = tooltip,
                Style = GlassStyles.ButtonStyle(13),
                Width = 26,
                Height = 26,
                Margin = new Thickness(5, 0, 0, 0),
            };
        }

        private void BuildTaskList(Grid layout)
        {
            taskScroll.VerticalScrollBarVisibility = ScrollBarVisibility.Hidden;
            taskScroll.HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled;
            taskScroll.Content = tasksPanel;
            Grid.SetRow(taskScroll, 1);
            layout.Children.Add(taskScroll);
        }

        private FrameworkElement BuildComposer()
        {
            var grid = new Grid { Margin = new Thickness(0, 12, 0, 0) };
            grid.ColumnDefinitions.Add(new ColumnDefinition());
            Grid.SetRow(grid, 2);
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(34) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(9) });
            composer.Style = GlassStyles.TextBoxStyle();
            composer.Height = 34;
            composer.VerticalContentAlignment = VerticalAlignment.Center;
            composer.FontSize = 12;
            composer.ToolTip = "添加新待办，回车保存";
            composer.KeyDown += delegate(object sender, KeyEventArgs e)
            {
                if (e.Key == Key.Enter) AddTask();
            };
            grid.Children.Add(composer);
            var add = new Button
            {
                Content = "+",
                Style = GlassStyles.ButtonStyle(15),
                Width = 30,
                Height = 30,
                HorizontalAlignment = HorizontalAlignment.Right,
            };
            add.Click += delegate { AddTask(); };
            Grid.SetColumn(add, 1);
            grid.Children.Add(add);

            var resize = new ResizeGrip
            {
                Width = 9,
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment = VerticalAlignment.Stretch,
                Cursor = Cursors.SizeWE,
                Background = Brushes.Transparent,
            };
            resize.MouseLeftButtonDown += BeginResize;
            resize.MouseMove += ContinueResize;
            resize.MouseLeftButtonUp += EndResize;
            Grid.SetColumn(resize, 2);
            grid.Children.Add(resize);
            return grid;
        }

        private void BuildErrorBar(Grid layout)
        {
            errorText.Foreground = new SolidColorBrush(Color.FromRgb(139, 38, 53));
            errorText.FontSize = 10;
            errorText.TextWrapping = TextWrapping.Wrap;
            errorBar.Child = errorText;
            errorBar.Background = new SolidColorBrush(Color.FromArgb(220, 255, 235, 238));
            errorBar.CornerRadius = new CornerRadius(8);
            errorBar.Padding = new Thickness(8, 5, 8, 5);
            errorBar.Margin = new Thickness(5, 0, 5, 7);
            errorBar.VerticalAlignment = VerticalAlignment.Bottom;
            errorBar.Visibility = Visibility.Collapsed;
            errorBar.IsHitTestVisible = false;
            Grid.SetRow(errorBar, 1);
            layout.Children.Add(errorBar);
        }

        private void BuildListPopup()
        {
            listPopupItems = new StackPanel();
            if (snapshot == null) return;
            foreach (var list in snapshot.Lists)
            {
                var item = list;
                var button = new Button
                {
                    Content = item.Name,
                    Style = GlassStyles.ButtonStyle(9),
                    Height = 32,
                    Margin = new Thickness(3),
                    HorizontalContentAlignment = HorizontalAlignment.Left,
                    Focusable = false,
                };
                button.Click += delegate
                {
                    listPopup.IsOpen = false;
                    Protocol.WriteEvent(new EventDto { Type = "selectList", ListId = item.Id });
                };
                listPopupItems.Children.Add(button);
            }
            var border = new Border
            {
                Child = listPopupItems,
                MinWidth = 150,
                Padding = new Thickness(4),
                CornerRadius = new CornerRadius(13),
                Background = new SolidColorBrush(Color.FromArgb(225, 247, 251, 255)),
                BorderBrush = GlassStyles.Edge,
                BorderThickness = new Thickness(1),
                Effect = GlassStyles.Shadow(),
            };
            listPopup.Child = border;
            listPopup.AllowsTransparency = true;
            listPopup.StaysOpen = false;
            listPopup.Focusable = false;
        }

        private void ApplySnapshot(SnapshotDto value)
        {
            if (value == null || value.Position == null || value.Lists == null || value.Tasks == null)
                throw new InvalidDataException("贴片状态不完整");
            snapshot = value;
            ApplyGeometry(value.Position);
            var selected = FindList(value.SelectedListId);
            listLabel.Text = selected == null ? "我的待办" : selected.Name;
            countLabel.Text = value.Tasks.Length + " 项";
            taskScroll.Height = Geometry.ScrollHeight(value.Tasks.Length);
            tasksPanel.Children.Clear();
            if (value.Tasks.Length == 0)
            {
                var empty = new TextBlock
                {
                    Text = "没有待办任务",
                    Foreground = GlassStyles.SecondaryText,
                    FontSize = 11,
                    TextAlignment = TextAlignment.Center,
                    VerticalAlignment = VerticalAlignment.Center,
                    Height = 42,
                    Cursor = Cursors.SizeAll,
                };
                tasksPanel.Children.Add(empty);
                return;
            }
            foreach (var task in value.Tasks) tasksPanel.Children.Add(BuildTaskRow(task));
        }

        private FrameworkElement BuildTaskRow(TaskDto task)
        {
            var card = new Border
            {
                Height = 38,
                Margin = new Thickness(0, 2, 0, 2),
                Padding = new Thickness(8, 0, 8, 0),
                CornerRadius = new CornerRadius(11),
                Background = GlassStyles.CardBackground(16),
                BorderBrush = new SolidColorBrush(Color.FromArgb(62, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                AllowDrop = true,
                Tag = task,
            };
            card.MouseEnter += delegate { card.Background = GlassStyles.CardBackground(38); };
            card.MouseLeave += delegate { card.Background = GlassStyles.CardBackground(16); };
            card.DragOver += delegate(object sender, DragEventArgs e)
            {
                e.Effects = DragDropEffects.Move;
                e.Handled = true;
            };
            card.Drop += delegate(object sender, DragEventArgs e)
            {
                var dragged = e.Data.GetData(DataFormats.Text) as string;
                if (!string.IsNullOrEmpty(dragged) && dragged != task.Id)
                {
                    Protocol.WriteEvent(new EventDto
                    {
                        Type = "reorder",
                        ListId = task.ListId,
                        DraggedId = dragged,
                        TargetId = task.Id,
                    });
                }
            };

            var grid = new Grid();
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(17) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(25) });
            grid.ColumnDefinitions.Add(new ColumnDefinition());
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            var grip = new SortGrip
            {
                Text = "⠿",
                Foreground = GlassStyles.SecondaryText,
                Cursor = Cursors.SizeAll,
                VerticalAlignment = VerticalAlignment.Center,
                Tag = card,
            };
            grip.MouseLeftButtonDown += delegate(object sender, MouseButtonEventArgs e)
            {
                dragCandidate = task;
                dragStart = e.GetPosition(this);
                ((TextBlock)sender).CaptureMouse();
                e.Handled = true;
            };
            grip.MouseMove += delegate(object sender, MouseEventArgs e)
            {
                if (dragCandidate != task || e.LeftButton != MouseButtonState.Pressed) return;
                var current = e.GetPosition(this);
                if (Math.Abs(current.X - dragStart.X) < 4 && Math.Abs(current.Y - dragStart.Y) < 4) return;
                DragDrop.DoDragDrop(card, task.Id, DragDropEffects.Move);
                ((TextBlock)sender).ReleaseMouseCapture();
                dragCandidate = null;
            };
            grip.MouseLeftButtonUp += delegate(object sender, MouseButtonEventArgs e)
            {
                dragCandidate = null;
                ((TextBlock)sender).ReleaseMouseCapture();
            };
            grid.Children.Add(grip);

            var complete = new Button
            {
                Style = GlassStyles.ButtonStyle(9),
                Width = 18,
                Height = 18,
                Padding = new Thickness(0),
                ToolTip = "完成任务",
                Content = new Ellipse { Width = 5, Height = 5, Fill = Brushes.Transparent },
            };
            complete.Click += delegate { Protocol.WriteEvent(new EventDto { Type = "complete", TaskId = task.Id }); };
            Grid.SetColumn(complete, 1);
            grid.Children.Add(complete);

            var title = new TextBlock
            {
                Text = task.Title,
                FontSize = 12,
                FontWeight = FontWeights.Medium,
                TextTrimming = TextTrimming.CharacterEllipsis,
                VerticalAlignment = VerticalAlignment.Center,
            };
            Grid.SetColumn(title, 2);
            grid.Children.Add(title);
            if (!string.IsNullOrEmpty(task.DueLocal))
            {
                var due = new TextBlock
                {
                    Text = task.DueLocal.Replace('T', ' '),
                    Foreground = GlassStyles.SecondaryText,
                    FontSize = 9,
                    Margin = new Thickness(8, 0, 0, 0),
                    VerticalAlignment = VerticalAlignment.Center,
                };
                Grid.SetColumn(due, 3);
                grid.Children.Add(due);
            }
            card.Child = grid;
            return card;
        }

        private void AddTask()
        {
            if (string.IsNullOrWhiteSpace(composer.Text)) return;
            errorBar.Visibility = Visibility.Collapsed;
            Protocol.WriteEvent(new EventDto { Type = "add", Title = composer.Text });
        }

        private void BeginWindowDrag(object sender, MouseButtonEventArgs e)
        {
            if (e.LeftButton != MouseButtonState.Pressed
                || !WidgetInput.CanStartWindowDrag(e.OriginalSource as DependencyObject)) return;
            try
            {
                e.Handled = true;
                DragMove();
                Protocol.WriteEvent(new EventDto { Type = "moved", X = (int)Math.Round(Left), Y = (int)Math.Round(Top) });
            }
            catch (InvalidOperationException) { }
        }

        private void BeginResize(object sender, MouseButtonEventArgs e)
        {
            resizing = true;
            resizeWidth = Width;
            resizeOrigin = e.GetPosition(this);
            ((Border)sender).CaptureMouse();
            e.Handled = true;
        }

        private void ContinueResize(object sender, MouseEventArgs e)
        {
            if (!resizing) return;
            var current = e.GetPosition(this);
            Width = Geometry.ResizeWidth((int)Math.Round(resizeWidth), (int)Math.Round(current.X - resizeOrigin.X));
        }

        private void EndResize(object sender, MouseButtonEventArgs e)
        {
            if (!resizing) return;
            resizing = false;
            ((Border)sender).ReleaseMouseCapture();
            Protocol.WriteEvent(new EventDto { Type = "resized", Width = (int)Math.Round(Width) });
        }

        private ListDto FindList(string id)
        {
            if (snapshot == null) return null;
            foreach (var list in snapshot.Lists) if (list.Id == id) return list;
            return null;
        }

        private void ApplyGeometry(PositionDto position)
        {
            if (position == null) throw new InvalidDataException("贴片位置缺失");
            Left = position.X;
            Top = position.Y;
            Width = Geometry.ClampWidth(position.Width);
            Height = position.Height;
        }

        private async void ReadCommands()
        {
            try
            {
                while (true)
                {
                    var line = await input.ReadLineAsync();
                    if (line == null) break;
                    var command = line;
                    try
                    {
                        Dispatcher.Invoke(new Action(() => HandleCommand(command)));
                    }
                    catch (Exception error)
                    {
                        Protocol.WriteEvent(new EventDto { Type = "error", Message = error.Message });
                    }
                }
                Dispatcher.InvokeShutdown();
            }
            catch (Exception error)
            {
                Protocol.WriteEvent(new EventDto { Type = "error", Message = error.Message });
            }
        }

        private void HandleCommand(string line)
        {
            var commandType = Protocol.ReadCommandType(line);
            switch (commandType)
            {
                case "init":
                    ApplySnapshot(Protocol.Deserialize<InitCommand>(line).Snapshot);
                    break;
                case "state":
                    ApplySnapshot(Protocol.Deserialize<StateCommand>(line).Snapshot);
                    break;
                case "visibility":
                    if (Protocol.Deserialize<VisibilityCommand>(line).Visible) Show();
                    else Hide();
                    break;
                case "geometry":
                    ApplyGeometry(Protocol.Deserialize<GeometryCommand>(line).Position);
                    break;
                case "operationResult":
                    var result = Protocol.Deserialize<OperationResultCommand>(line);
                    errorText.Text = result.Message;
                    errorBar.Visibility = result.Success ? Visibility.Collapsed : Visibility.Visible;
                    if (result.Success && result.Action == "add") composer.Clear();
                    break;
                case "shutdown":
                    shuttingDown = true;
                    Application.Current.Shutdown();
                    break;
                default:
                    throw new InvalidDataException("未知贴片命令");
            }
        }
    }
}
