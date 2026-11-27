using System.Runtime.Serialization;

namespace LightTodo.Widget
{
    [DataContract]
    public sealed class ListDto
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "name")] public string Name { get; set; }
    }

    [DataContract]
    public sealed class TaskDto
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "listId")] public string ListId { get; set; }
        [DataMember(Name = "title")] public string Title { get; set; }
        [DataMember(Name = "dueLocal")] public string DueLocal { get; set; }
        [DataMember(Name = "completedAt")] public string CompletedAt { get; set; }
    }

    [DataContract]
    public sealed class PositionDto
    {
        [DataMember(Name = "displayId")] public long DisplayId { get; set; }
        [DataMember(Name = "x")] public int X { get; set; }
        [DataMember(Name = "y")] public int Y { get; set; }
        [DataMember(Name = "width")] public int Width { get; set; }
        [DataMember(Name = "height")] public int Height { get; set; }
    }

    [DataContract]
    public sealed class SnapshotDto
    {
        [DataMember(Name = "lists")] public ListDto[] Lists { get; set; }
        [DataMember(Name = "selectedListId")] public string SelectedListId { get; set; }
        [DataMember(Name = "tasks")] public TaskDto[] Tasks { get; set; }
        [DataMember(Name = "position")] public PositionDto Position { get; set; }
    }

    [DataContract]
    public sealed class EventDto
    {
        [DataMember(Name = "type")] public string Type { get; set; }
        [DataMember(Name = "title", EmitDefaultValue = false)] public string Title { get; set; }
        [DataMember(Name = "taskId", EmitDefaultValue = false)] public string TaskId { get; set; }
        [DataMember(Name = "listId", EmitDefaultValue = false)] public string ListId { get; set; }
        [DataMember(Name = "draggedId", EmitDefaultValue = false)] public string DraggedId { get; set; }
        [DataMember(Name = "targetId", EmitDefaultValue = false)] public string TargetId { get; set; }
        [DataMember(Name = "x", EmitDefaultValue = false)] public int X { get; set; }
        [DataMember(Name = "y", EmitDefaultValue = false)] public int Y { get; set; }
        [DataMember(Name = "width", EmitDefaultValue = false)] public int Width { get; set; }
        [DataMember(Name = "message", EmitDefaultValue = false)] public string Message { get; set; }
    }

    [DataContract]
    public sealed class InitCommand
    {
        public InitCommand() { Type = "init"; }
        [DataMember(Name = "type")] public string Type { get; private set; }
        [DataMember(Name = "snapshot")] public SnapshotDto Snapshot { get; set; }
    }

    [DataContract]
    public sealed class StateCommand
    {
        public StateCommand() { Type = "state"; }
        [DataMember(Name = "type")] public string Type { get; private set; }
        [DataMember(Name = "snapshot")] public SnapshotDto Snapshot { get; set; }
    }

    [DataContract]
    public sealed class VisibilityCommand
    {
        public VisibilityCommand() { Type = "visibility"; }
        [DataMember(Name = "type")] public string Type { get; private set; }
        [DataMember(Name = "visible")] public bool Visible { get; set; }
    }

    [DataContract]
    public sealed class GeometryCommand
    {
        public GeometryCommand() { Type = "geometry"; }
        [DataMember(Name = "type")] public string Type { get; private set; }
        [DataMember(Name = "position")] public PositionDto Position { get; set; }
    }

    [DataContract]
    public sealed class OperationResultCommand
    {
        public OperationResultCommand() { Type = "operationResult"; }
        [DataMember(Name = "type")] public string Type { get; private set; }
        [DataMember(Name = "action")] public string Action { get; set; }
        [DataMember(Name = "success")] public bool Success { get; set; }
        [DataMember(Name = "message")] public string Message { get; set; }
    }

    [DataContract]
    public sealed class ShutdownCommand
    {
        public ShutdownCommand() { Type = "shutdown"; }
        [DataMember(Name = "type")] public string Type { get; private set; }
    }
}
