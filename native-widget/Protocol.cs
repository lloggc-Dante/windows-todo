using System;
using System.Collections.Generic;
using System.IO;
using System.Web.Script.Serialization;
using System.Text;

namespace LightTodo.Widget
{
    public static class Protocol
    {
        private static readonly Encoding Utf8 = new UTF8Encoding(false);

        private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer();

        public static string Serialize<T>(T value)
        {
            return Serializer.Serialize(value);
        }

        public static T Deserialize<T>(string json)
        {
            return Serializer.Deserialize<T>(json);
        }

        public static string ReadCommandType(string json)
        {
            var match = System.Text.RegularExpressions.Regex.Match(json, "\\\"type\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
            if (!match.Success) throw new InvalidDataException("消息类型缺失");
            return match.Groups[1].Value;
        }

        public static EventDto ReadEvent(string json)
        {
            var value = Deserialize<EventDto>(json);
            if (value == null || string.IsNullOrEmpty(value.Type)) throw new InvalidDataException("消息类型缺失");
            return value;
        }

        public static void WriteEvent(EventDto value)
        {
            var message = new Dictionary<string, object> { { "type", value.Type } };
            if (value.Title != null) message["title"] = value.Title;
            if (value.TaskId != null) message["taskId"] = value.TaskId;
            if (value.ListId != null) message["listId"] = value.ListId;
            if (value.DraggedId != null) message["draggedId"] = value.DraggedId;
            if (value.TargetId != null) message["targetId"] = value.TargetId;
            if (value.Type == "moved") { message["x"] = value.X; message["y"] = value.Y; }
            if (value.Type == "resized") message["width"] = value.Width;
            if (value.Message != null) message["message"] = value.Message;
            var line = Serializer.Serialize(message) + "\n";
            var bytes = Utf8.GetBytes(line);
            Console.OpenStandardOutput().Write(bytes, 0, bytes.Length);
        }
    }
}
