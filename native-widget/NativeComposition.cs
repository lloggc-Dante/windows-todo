using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Shell;

namespace LightTodo.Widget
{
    public static class NativeComposition
    {
        private const int DwmwaWindowCornerPreference = 33;
        private const int DwmwcpDoNotRound = 1;
        private const int WindowCompositionAttribute = 19;
        private const int AccentEnableBlurBehind = 3;

        [StructLayout(LayoutKind.Sequential)]
        private struct Margins
        {
            public int Left;
            public int Right;
            public int Top;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct NativeRect
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct AccentPolicy
        {
            public int AccentState;
            public int AccentFlags;
            public int GradientColor;
            public int AnimationId;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct CompositionAttributeData
        {
            public int Attribute;
            public IntPtr Data;
            public int Size;
        }

        [DllImport("dwmapi.dll", PreserveSig = true)]
        private static extern int DwmIsCompositionEnabled(out bool enabled);

        [DllImport("dwmapi.dll", PreserveSig = true)]
        private static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref Margins margins);

        [DllImport("dwmapi.dll", PreserveSig = true)]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowCompositionAttribute(IntPtr hwnd, ref CompositionAttributeData data);

        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hwnd, out NativeRect rect);

        [DllImport("user32.dll")]
        private static extern uint GetDpiForWindow(IntPtr hwnd);

        [DllImport("gdi32.dll")]
        private static extern IntPtr CreateRoundRectRgn(int left, int top, int right, int bottom, int width, int height);

        [DllImport("user32.dll")]
        private static extern int SetWindowRgn(IntPtr hwnd, IntPtr region, bool redraw);

        public static void Prepare(Window window)
        {
            WindowChrome.SetWindowChrome(window, new WindowChrome
            {
                GlassFrameThickness = new Thickness(-1),
                CaptionHeight = 0,
                UseAeroCaptionButtons = false,
                ResizeBorderThickness = new Thickness(0),
            });
            window.SizeChanged += delegate { ApplyWindowRegion(window); };
            window.DpiChanged += delegate { ApplyWindowRegion(window); };
        }

        public static bool Configure(Window window)
        {
            var hwnd = new WindowInteropHelper(window).Handle;
            ApplyWindowRegion(window);
            return TryApply(hwnd);
        }

        public static bool TryApply(IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero) return false;
            try
            {
                bool enabled;
                if (DwmIsCompositionEnabled(out enabled) != 0 || !enabled) return false;
                var margins = new Margins { Left = -1, Right = -1, Top = -1, Bottom = -1 };
                if (DwmExtendFrameIntoClientArea(hwnd, ref margins) != 0) return false;
                var corner = DwmwcpDoNotRound;
                if (DwmSetWindowAttribute(hwnd, DwmwaWindowCornerPreference, ref corner, sizeof(int)) != 0) return false;
                return ApplyBlurBehind(hwnd);
            }
            catch (Exception)
            {
                return false;
            }
        }

        private static void ApplyWindowRegion(Window window)
        {
            var hwnd = new WindowInteropHelper(window).Handle;
            NativeRect rect;
            if (hwnd == IntPtr.Zero || !GetWindowRect(hwnd, out rect)) return;
            var dpi = GetDpiForWindow(hwnd);
            if (dpi == 0) dpi = 96;
            var diameter = (int)Math.Round(52 * dpi / 96.0);
            var region = CreateRoundRectRgn(0, 0, rect.Right - rect.Left + 1, rect.Bottom - rect.Top + 1, diameter, diameter);
            if (region != IntPtr.Zero) SetWindowRgn(hwnd, region, true);
        }

        private static bool ApplyBlurBehind(IntPtr hwnd)
        {
            var accent = new AccentPolicy
            {
                AccentState = AccentEnableBlurBehind,
                AccentFlags = 0,
                GradientColor = 0x01FFFFFF,
                AnimationId = 0,
            };
            var size = Marshal.SizeOf(typeof(AccentPolicy));
            var memory = Marshal.AllocHGlobal(size);
            try
            {
                Marshal.StructureToPtr(accent, memory, false);
                var data = new CompositionAttributeData
                {
                    Attribute = WindowCompositionAttribute,
                    Data = memory,
                    Size = size,
                };
                return SetWindowCompositionAttribute(hwnd, ref data);
            }
            finally
            {
                Marshal.FreeHGlobal(memory);
            }
        }

        public static void SelfTest()
        {
            bool enabled;
            if (DwmIsCompositionEnabled(out enabled) != 0 || !enabled)
                throw new InvalidOperationException("DWM 合成不可用");
            var margins = new Margins { Left = -1, Right = -1, Top = -1, Bottom = -1 };
            if (DwmExtendFrameIntoClientArea(IntPtr.Zero, ref margins) == 0)
                throw new InvalidOperationException("无效 HWND 不应配置成功");
        }
    }
}
