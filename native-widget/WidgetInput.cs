using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;

namespace LightTodo.Widget
{
    public sealed class SortGrip : TextBlock
    {
    }

    public sealed class ResizeGrip : Border
    {
    }

    public static class WidgetInput
    {
        public static bool CanStartWindowDrag(DependencyObject source)
        {
            if (source == null) return false;
            while (source != null)
            {
                if (source is ButtonBase || source is TextBoxBase || source is ScrollBar
                    || source is SortGrip || source is ResizeGrip) return false;
                source = VisualTreeHelper.GetParent(source) ?? LogicalTreeHelper.GetParent(source);
            }
            return true;
        }
    }
}
