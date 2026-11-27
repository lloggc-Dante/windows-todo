using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;

namespace LightTodo.Widget
{
    public static class GlassStyles
    {
        public static readonly bool MotionEnabled = SystemParameters.ClientAreaAnimation;
        public static readonly SolidColorBrush Text = Brush("#26364E");
        public static readonly SolidColorBrush SecondaryText = Brush("#61758C");
        public static readonly SolidColorBrush Accent = Brush("#4C78D5");
        public static readonly SolidColorBrush Edge = Brush("#C8FFFFFF");

        public static LinearGradientBrush ShellBackground()
        {
            var brush = new LinearGradientBrush { StartPoint = new Point(0, 0), EndPoint = new Point(1, 1) };
            brush.GradientStops.Add(new GradientStop(Color.FromArgb(13, 255, 255, 255), 0));
            brush.GradientStops.Add(new GradientStop(Color.FromArgb(5, 240, 248, 255), 0.48));
            brush.GradientStops.Add(new GradientStop(Color.FromArgb(9, 214, 239, 255), 1));
            return brush;
        }

        public static LinearGradientBrush ShellEdgeBrush()
        {
            var brush = new LinearGradientBrush { StartPoint = new Point(0, 0), EndPoint = new Point(0.85, 1) };
            brush.GradientStops.Add(new GradientStop(Color.FromArgb(245, 255, 255, 255), 0));
            brush.GradientStops.Add(new GradientStop(Color.FromArgb(72, 255, 255, 255), 0.32));
            brush.GradientStops.Add(new GradientStop(Color.FromArgb(150, 205, 237, 255), 0.68));
            brush.GradientStops.Add(new GradientStop(Color.FromArgb(215, 255, 255, 255), 1));
            return brush;
        }

        public static LinearGradientBrush CardBackground(byte alpha)
        {
            var brush = new LinearGradientBrush { StartPoint = new Point(0, 0), EndPoint = new Point(1, 1) };
            brush.GradientStops.Add(new GradientStop(Color.FromArgb(alpha, 255, 255, 255), 0));
            brush.GradientStops.Add(new GradientStop(Color.FromArgb((byte)(alpha / 3), 228, 244, 255), 0.55));
            brush.GradientStops.Add(new GradientStop(Color.FromArgb((byte)(alpha / 2), 237, 246, 255), 1));
            return brush;
        }

        public static DropShadowEffect Shadow()
        {
            return new DropShadowEffect
            {
                Color = Color.FromRgb(66, 105, 137),
                Opacity = 0.12,
                BlurRadius = 14,
                ShadowDepth = 2,
            };
        }

        public static Style ButtonStyle(double radius)
        {
            var style = new Style(typeof(Button));
            style.Setters.Add(new Setter(Control.ForegroundProperty, Text));
            style.Setters.Add(new Setter(Control.BackgroundProperty, CardBackground(22)));
            style.Setters.Add(new Setter(Control.BorderBrushProperty, Edge));
            style.Setters.Add(new Setter(Control.BorderThicknessProperty, new Thickness(1)));
            style.Setters.Add(new Setter(FrameworkElement.CursorProperty, Cursors.Hand));
            style.Setters.Add(new Setter(FrameworkElement.FocusVisualStyleProperty, null));

            var template = new ControlTemplate(typeof(Button));
            var surface = new FrameworkElementFactory(typeof(Border), "surface");
            surface.SetValue(Border.CornerRadiusProperty, new CornerRadius(radius));
            surface.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Control.BackgroundProperty));
            surface.SetValue(Border.BorderBrushProperty, new TemplateBindingExtension(Control.BorderBrushProperty));
            surface.SetValue(Border.BorderThicknessProperty, new TemplateBindingExtension(Control.BorderThicknessProperty));
            surface.SetValue(UIElement.RenderTransformOriginProperty, new Point(0.5, 0.5));
            surface.SetValue(UIElement.RenderTransformProperty, new ScaleTransform(1, 1));
            var layers = new FrameworkElementFactory(typeof(Grid));
            var glow = new FrameworkElementFactory(typeof(Border), "glow");
            glow.SetValue(Border.CornerRadiusProperty, new CornerRadius(radius));
            glow.SetValue(UIElement.IsHitTestVisibleProperty, false);
            glow.SetValue(UIElement.OpacityProperty, 0.0);
            var glowBrush = new RadialGradientBrush
            {
                GradientOrigin = new Point(0.25, 0.1),
                Center = new Point(0.25, 0.1),
                RadiusX = 0.9,
                RadiusY = 1,
            };
            glowBrush.GradientStops.Add(new GradientStop(Color.FromArgb(190, 255, 255, 255), 0));
            glowBrush.GradientStops.Add(new GradientStop(Color.FromArgb(0, 255, 255, 255), 1));
            glow.SetValue(Border.BackgroundProperty, glowBrush);
            layers.AppendChild(glow);
            var content = new FrameworkElementFactory(typeof(ContentPresenter));
            content.SetValue(FrameworkElement.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            content.SetValue(FrameworkElement.VerticalAlignmentProperty, VerticalAlignment.Center);
            layers.AppendChild(content);
            surface.AppendChild(layers);
            template.VisualTree = surface;
            var hover = new Trigger { Property = UIElement.IsMouseOverProperty, Value = true };
            hover.Setters.Add(new Setter(Border.BackgroundProperty, CardBackground(48), "surface"));
            hover.Setters.Add(new Setter(Border.EffectProperty, Shadow(), "surface"));
            hover.Setters.Add(new Setter(UIElement.OpacityProperty, 0.8, "glow"));
            template.Triggers.Add(hover);
            var pressed = new Trigger { Property = ButtonBase.IsPressedProperty, Value = true };
            pressed.Setters.Add(new Setter(Border.BackgroundProperty, CardBackground(64), "surface"));
            pressed.Setters.Add(new Setter(UIElement.OpacityProperty, 0.28, "glow"));
            template.Triggers.Add(pressed);
            if (MotionEnabled)
            {
                AddButtonMotion(template, Button.MouseEnterEvent, 1.045);
                AddButtonMotion(template, Button.MouseLeaveEvent, 1);
                AddButtonMotion(template, Button.PreviewMouseDownEvent, 0.94);
                AddButtonMotion(template, Button.PreviewMouseUpEvent, 1.045);
            }
            style.Setters.Add(new Setter(Control.TemplateProperty, template));
            return style;
        }

        private static void AddButtonMotion(ControlTemplate template, RoutedEvent routedEvent, double scale)
        {
            var storyboard = new Storyboard();
            AddScaleAnimation(storyboard, "ScaleX", scale);
            AddScaleAnimation(storyboard, "ScaleY", scale);
            var trigger = new EventTrigger(routedEvent);
            trigger.Actions.Add(new BeginStoryboard { Storyboard = storyboard });
            template.Triggers.Add(trigger);
        }

        private static void AddScaleAnimation(Storyboard storyboard, string axis, double scale)
        {
            var animation = new DoubleAnimation
            {
                To = scale,
                Duration = new Duration(TimeSpan.FromMilliseconds(150)),
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
            };
            Storyboard.SetTargetName(animation, "surface");
            Storyboard.SetTargetProperty(animation, new PropertyPath("RenderTransform.(ScaleTransform." + axis + ")"));
            storyboard.Children.Add(animation);
        }

        public static Style TextBoxStyle()
        {
            var style = new Style(typeof(TextBox));
            style.Setters.Add(new Setter(Control.ForegroundProperty, Text));
            style.Setters.Add(new Setter(Control.BackgroundProperty, CardBackground(25)));
            style.Setters.Add(new Setter(Control.BorderBrushProperty, Edge));
            style.Setters.Add(new Setter(Control.BorderThicknessProperty, new Thickness(1)));
            style.Setters.Add(new Setter(FrameworkElement.FocusVisualStyleProperty, null));
            style.Setters.Add(new Setter(TextBox.CaretBrushProperty, Text));

            var template = new ControlTemplate(typeof(TextBox));
            var surface = new FrameworkElementFactory(typeof(Border), "surface");
            surface.SetValue(Border.CornerRadiusProperty, new CornerRadius(16));
            surface.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Control.BackgroundProperty));
            surface.SetValue(Border.BorderBrushProperty, new TemplateBindingExtension(Control.BorderBrushProperty));
            surface.SetValue(Border.BorderThicknessProperty, new TemplateBindingExtension(Control.BorderThicknessProperty));
            var host = new FrameworkElementFactory(typeof(ScrollViewer), "PART_ContentHost");
            host.SetValue(FrameworkElement.MarginProperty, new Thickness(12, 0, 8, 0));
            host.SetValue(FrameworkElement.VerticalAlignmentProperty, VerticalAlignment.Center);
            surface.AppendChild(host);
            template.VisualTree = surface;
            var focus = new Trigger { Property = UIElement.IsKeyboardFocusedProperty, Value = true };
            focus.Setters.Add(new Setter(Border.BorderBrushProperty, Brushes.White, "surface"));
            focus.Setters.Add(new Setter(Border.BackgroundProperty, CardBackground(42), "surface"));
            template.Triggers.Add(focus);
            style.Setters.Add(new Setter(Control.TemplateProperty, template));
            return style;
        }

        private static SolidColorBrush Brush(string value)
        {
            return new SolidColorBrush((Color)ColorConverter.ConvertFromString(value));
        }
    }
}
