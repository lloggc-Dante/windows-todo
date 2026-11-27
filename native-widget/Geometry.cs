using System;

namespace LightTodo.Widget
{
    public static class Geometry
    {
        public const int RowHeight = 42;
        public const int BaseHeight = 136;
        public const int MaxRows = 8;

        public static int Rows(int taskCount)
        {
            return Math.Min(MaxRows, Math.Max(1, taskCount));
        }

        public static int WidgetHeight(int taskCount)
        {
            return BaseHeight + Rows(taskCount) * RowHeight;
        }

        public static int ScrollHeight(int taskCount)
        {
            return Rows(taskCount) * RowHeight;
        }

        public static int ResizeWidth(int startWidth, int deltaDips)
        {
            return ClampWidth(startWidth + deltaDips);
        }

        public static int ClampWidth(int width)
        {
            return Math.Min(480, Math.Max(320, width));
        }
    }
}
