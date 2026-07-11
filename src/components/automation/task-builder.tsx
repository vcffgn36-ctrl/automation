'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TASK_TYPES,
  TASK_USES_SELECTOR,
  TASK_USES_VALUE,
  type TaskInput,
  type TaskType,
} from '@/lib/automation-types'
import { TASK_PRESETS } from '@/lib/templates'
import { cn } from '@/lib/utils'

interface TaskBuilderProps {
  value: TaskInput[]
  onChange: (next: TaskInput[]) => void
}

const TASK_LABELS: Record<TaskType, string> = {
  navigate: 'Navigate (URL)',
  click: 'Click',
  fill: 'Fill',
  press: 'Press key',
  wait: 'Wait (ms)',
  wait_for_selector: 'Wait for selector',
  screenshot: 'Screenshot',
  extract: 'Extract text',
  extract_all: 'Extract all (list)',
  extract_links: 'Extract links',
  extract_regex: 'Extract regex (codes)',
  scroll: 'Scroll (px)',
  select: 'Select option',
  evaluate: 'Evaluate JS',
}

function newTask(): TaskInput {
  return {
    type: 'screenshot',
    selector: null,
    value: null,
    description: null,
    waitMs: 0,
    timeoutMs: 30000,
  }
}

function SortableRow({
  id,
  task,
  onChange,
  onRemove,
}: {
  id: string
  task: TaskInput
  onChange: (next: TaskInput) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties

  const usesSelector = TASK_USES_SELECTOR.has(task.type)
  const usesValue = TASK_USES_VALUE.has(task.type)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border border-border/70 bg-card p-3 shadow-sm',
        isDragging && 'opacity-60 ring-2 ring-emerald-400',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-2.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-manipulation"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</Label>
            <Select
              value={task.type}
              onValueChange={(v) => onChange({ ...task, type: v as TaskType })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TASK_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Description</Label>
            <Input
              value={task.description ?? ''}
              onChange={(e) => onChange({ ...task, description: e.target.value || null })}
              placeholder="optional note"
              className="h-9"
            />
          </div>

          {usesSelector && (
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Selector</Label>
              <Input
                value={task.selector ?? ''}
                onChange={(e) => onChange({ ...task, selector: e.target.value || null })}
                placeholder="e.g. button.submit"
                className="h-9 font-mono text-xs"
              />
            </div>
          )}

          {usesValue && (
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Value</Label>
              <Input
                value={task.value ?? ''}
                onChange={(e) => onChange({ ...task, value: e.target.value || null })}
                placeholder={
                  task.type === 'navigate'
                    ? 'https://...'
                    : task.type === 'press'
                      ? 'Enter'
                      : task.type === 'evaluate'
                        ? '() => document.title'
                        : task.type === 'extract_regex'
                          ? '\\d{4,8} (activation codes)'
                          : ''
                }
                className="h-9 font-mono text-xs"
              />
            </div>
          )}

          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Wait after (ms)</Label>
            <Input
              type="number"
              min={0}
              value={task.waitMs}
              onChange={(e) => onChange({ ...task, waitMs: Number(e.target.value) || 0 })}
              className="h-9"
            />
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Timeout (ms)</Label>
            <Input
              type="number"
              min={0}
              value={task.timeoutMs}
              onChange={(e) => onChange({ ...task, timeoutMs: Number(e.target.value) || 0 })}
              className="h-9"
            />
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="mt-6 text-destructive hover:bg-destructive/10"
          aria-label="Remove task"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function TaskBuilder({ value, onChange }: TaskBuilderProps) {
  // Stable IDs for dnd-kit — task identity is its position in the array
  // combined with the type so reordering works even with duplicates.
  const ids = value.map((_, i) => `task-${i}`)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = ids.indexOf(active.id as string)
    const newIdx = ids.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) return
    onChange(arrayMove(value, oldIdx, newIdx))
  }

  function add() {
    onChange([...value, newTask()])
  }

  function update(idx: number, next: TaskInput) {
    const copy = [...value]
    copy[idx] = next
    onChange(copy)
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            {value.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No tasks yet. Add one below — they run in order after login.
              </div>
            )}
            {value.map((t, i) => (
              <SortableRow
                key={ids[i]}
                id={ids[i]}
                task={t}
                onChange={(next) => update(i, next)}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" />
          Add task
        </Button>

        {/* Quick-add task presets */}
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <Select
            value="__none"
            onValueChange={(id) => {
              const preset = TASK_PRESETS.find((p) => p.id === id)
              if (preset) {
                // Append the preset's tasks to the current list.
                onChange([...value, ...preset.tasks])
              }
            }}
          >
            <SelectTrigger className="h-8 w-auto min-w-[220px] text-xs">
              <SelectValue placeholder="Quick add task preset…" />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex flex-col">
                    <span className="font-medium text-xs">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">{p.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
