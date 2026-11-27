using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media.Animation;

namespace LightTodo.Widget
{
    public static class Program
    {
        [STAThread]
        public static int Main(string[] args)
        {
            if (args.Length == 1 && args[0] == "--self-test") return RunSelfTests();
            var application = new Application();
            application.Run(new WidgetWindow());
            return 0;
        }

        private static int RunSelfTests()
        {
            try
            {
                var source = new EventDto { Type = "add", Title = "中文任务" };
                var parsed = Protocol.ReadEvent(Protocol.Serialize(source));
                if (parsed.Type != "add" || parsed.Title != "中文任务")
                {
                    Console.Error.WriteLine("event mismatch: " + parsed.Type + " " + parsed.Title);
                    return 1;
                }
                var snapshot = new SnapshotDto
                {
                    Lists = new[] { new ListDto { Id = "list-1", Name = "我的待办" } },
                    SelectedListId = "list-1",
                    Tasks = new[] { new TaskDto { Id = "task-1", ListId = "list-1", Title = "任务", DueLocal = null, CompletedAt = null } },
                    Position = new PositionDto { DisplayId = 4239051520, X = 40, Y = 40, Width = 360, Height = 178 },
                };
                var state = new StateCommand { Snapshot = snapshot };
                var serializedState = Protocol.Serialize(state);
                var roundtrip = Protocol.Deserialize<StateCommand>(serializedState);
                if (roundtrip.Snapshot.Tasks.Length != 1 || roundtrip.Snapshot.Tasks[0].Id != "task-1") return 1;
                if (Protocol.ReadEvent(serializedState).Type != "state") return 1;
                if (!serializedState.Contains("我的待办"))
                {
                    Console.Error.WriteLine("state mismatch: " + serializedState);
                    return 1;
                }
                if (Geometry.WidgetHeight(0) != 178 || Geometry.WidgetHeight(1) != 178
                    || Geometry.WidgetHeight(8) != 472 || Geometry.WidgetHeight(9) != 472) return 1;
                if (Geometry.ClampWidth(100) != 320 || Geometry.ClampWidth(900) != 480) return 1;
                if (Geometry.RowHeight != 42 || Geometry.ScrollHeight(9) != 336) return 1;
                if (Geometry.ResizeWidth(360, 60) != 420) return 1;
                NativeComposition.SelfTest();
                if (NativeComposition.TryApply(IntPtr.Zero)) return 1;
                var buttonContent = new TextBlock { Text = "按钮文字" };
                var button = new Button { Content = buttonContent };
                var textBox = new TextBox();
                var scrollBar = new ScrollBar();
                var sortGrip = new SortGrip();
                var resizeGrip = new ResizeGrip();
                var taskTitle = new TextBlock { Text = "任务文字" };
                var header = new TextBlock { Text = "标题空白" };
                var shell = new Grid();
                shell.Children.Add(button);
                shell.Children.Add(textBox);
                shell.Children.Add(scrollBar);
                shell.Children.Add(sortGrip);
                shell.Children.Add(resizeGrip);
                shell.Children.Add(taskTitle);
                shell.Children.Add(header);
                if (WidgetInput.CanStartWindowDrag(buttonContent)) return 1;
                if (WidgetInput.CanStartWindowDrag(textBox)) return 1;
                if (WidgetInput.CanStartWindowDrag(scrollBar)) return 1;
                if (WidgetInput.CanStartWindowDrag(sortGrip)) return 1;
                if (WidgetInput.CanStartWindowDrag(resizeGrip)) return 1;
                if (!WidgetInput.CanStartWindowDrag(taskTitle)) return 1;
                if (!WidgetInput.CanStartWindowDrag(header)) return 1;
                if (!WidgetInput.CanStartWindowDrag(shell)) return 1;
                if (WidgetInput.CanStartWindowDrag(null)) return 1;
                var liquid = LiquidGlassLayer.Create();
                if (liquid.IsHitTestVisible) return 1;
                liquid.SetAnimationsEnabled(true);
                if (!liquid.AnimationsEnabled) return 1;
                liquid.FlowTransform.X = 13;
                liquid.SetAnimationsEnabled(false);
                if (liquid.AnimationsEnabled || liquid.FlowTransform.X != 0) return 1;
                if (GlassStyles.ShellEdgeBrush() == null) return 1;
                if (GlassStyles.MotionEnabled != SystemParameters.ClientAreaAnimation) return 1;
                var flowAnimation = LiquidGlassLayer.CreateFlowAnimation();
                if (!flowAnimation.AutoReverse || flowAnimation.RepeatBehavior != RepeatBehavior.Forever) return 1;
                return 0;
            }
            catch (Exception error)
            {
                Console.Error.WriteLine(error);
                return 1;
            }
        }
    }
}
