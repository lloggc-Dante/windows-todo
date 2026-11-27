using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
using System.Windows.Shapes;

namespace LightTodo.Widget
{
    public sealed class LiquidGlassLayer : Grid
    {
        public TranslateTransform FlowTransform { get; private set; }
        public bool AnimationsEnabled { get; private set; }

        private LiquidGlassLayer()
        {
            IsHitTestVisible = false;
            FlowTransform = new TranslateTransform();

            var spotlight = new Border
            {
                Height = 115,
                Margin = new Thickness(28, -42, 46, 0),
                VerticalAlignment = VerticalAlignment.Top,
                Background = new RadialGradientBrush
                {
                    GradientOrigin = new Point(0.32, 0.12),
                    Center = new Point(0.32, 0.12),
                    RadiusX = 0.85,
                    RadiusY = 0.9,
                    GradientStops = new GradientStopCollection
                    {
                        new GradientStop(Color.FromArgb(115, 255, 255, 255), 0),
                        new GradientStop(Color.FromArgb(34, 225, 247, 255), 0.48),
                        new GradientStop(Color.FromArgb(0, 255, 255, 255), 1),
                    },
                },
                Effect = new BlurEffect { Radius = 20 },
            };
            Children.Add(spotlight);

            var topRefraction = new Border
            {
                Height = 2,
                Margin = new Thickness(30, 1, 58, 0),
                VerticalAlignment = VerticalAlignment.Top,
                Background = new LinearGradientBrush
                {
                    StartPoint = new Point(0, 0),
                    EndPoint = new Point(1, 0),
                    GradientStops = new GradientStopCollection
                    {
                        new GradientStop(Color.FromArgb(0, 255, 255, 255), 0),
                        new GradientStop(Color.FromArgb(235, 255, 255, 255), 0.28),
                        new GradientStop(Color.FromArgb(105, 211, 241, 255), 0.66),
                        new GradientStop(Color.FromArgb(0, 255, 255, 255), 1),
                    },
                },
            };
            Children.Add(topRefraction);

            var flow = new Border
            {
                Width = 96,
                Margin = new Thickness(-65, 28, 0, 30),
                HorizontalAlignment = HorizontalAlignment.Left,
                Background = new LinearGradientBrush
                {
                    StartPoint = new Point(0, 0),
                    EndPoint = new Point(1, 0),
                    GradientStops = new GradientStopCollection
                    {
                        new GradientStop(Color.FromArgb(0, 255, 255, 255), 0),
                        new GradientStop(Color.FromArgb(54, 255, 255, 255), 0.45),
                        new GradientStop(Color.FromArgb(72, 255, 255, 255), 0.6),
                        new GradientStop(Color.FromArgb(0, 255, 255, 255), 1),
                    },
                },
                Effect = new BlurEffect { Radius = 13 },
            };
            var transforms = new TransformGroup();
            transforms.Children.Add(FlowTransform);
            transforms.Children.Add(new RotateTransform(13));
            flow.RenderTransform = transforms;
            Children.Add(flow);

            var lowerRefraction = new Rectangle
            {
                Height = 1,
                Margin = new Thickness(54, 0, 34, 2),
                VerticalAlignment = VerticalAlignment.Bottom,
                Fill = new LinearGradientBrush(
                    Color.FromArgb(0, 202, 239, 255),
                    Color.FromArgb(110, 255, 255, 255),
                    new Point(0, 0), new Point(1, 0)),
            };
            Children.Add(lowerRefraction);
        }

        public static LiquidGlassLayer Create()
        {
            return new LiquidGlassLayer();
        }

        public void SetAnimationsEnabled(bool enabled)
        {
            AnimationsEnabled = enabled;
            FlowTransform.BeginAnimation(TranslateTransform.XProperty, null);
            FlowTransform.X = 0;
            if (!enabled) return;
            FlowTransform.BeginAnimation(TranslateTransform.XProperty, CreateFlowAnimation());
        }

        public static DoubleAnimation CreateFlowAnimation()
        {
            return new DoubleAnimation
            {
                From = -12,
                To = 92,
                Duration = new Duration(TimeSpan.FromSeconds(6)),
                RepeatBehavior = RepeatBehavior.Forever,
                AutoReverse = true,
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
            };
        }
    }
}
