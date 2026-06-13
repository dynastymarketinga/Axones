import { Button } from "@/components/ui/button"

import type { AssistantChip } from "@/types/assistant"

type Props = {
  chips?: AssistantChip[]
  disabled?: boolean
  onPick: (chip: AssistantChip) => void
}

export function AssistantChips({ chips, disabled, onPick }: Props) {
  if (!chips || chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <Button
          key={`${chip.tool}-${chip.label}`}
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => onPick(chip)}
          className="h-7 rounded-full text-xs"
        >
          {chip.label}
        </Button>
      ))}
    </div>
  )
}
