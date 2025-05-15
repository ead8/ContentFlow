"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Settings } from "lucide-react"

interface WorkspaceSwitcherProps {
  current: string
  options: string[]
  onChange: (workspace: string) => void
  onAddNew?: () => void
  onSettings?: () => void
}

export function WorkspaceSwitcher({
  current,
  options,
  onChange,
  onAddNew,
  onSettings,
}: WorkspaceSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="text-sm font-medium">
          {current}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {options.map((workspace) => (
          <DropdownMenuItem
            key={workspace}
            onClick={() => onChange(workspace)}
            className="capitalize"
          >
            {workspace}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add New Workspace
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onSettings}>
          <Settings className="h-4 w-4 mr-2" />
          Workspace Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
