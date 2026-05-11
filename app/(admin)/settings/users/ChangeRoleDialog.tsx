"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserRole } from "@/lib/actions/user";
import type { Role } from "@/lib/rbac";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  currentRole: Role;
}

const HIERARCHY: Record<Role, number> = {
  STAFF: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

export function ChangeRoleDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentRole,
}: Props) {
  const router = useRouter();
  const [nextRole, setNextRole] = useState<Role>(currentRole);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNextRole(currentRole);
      setServerError(null);
    }
  }, [open, currentRole]);

  const isDowngrade = HIERARCHY[nextRole] < HIERARCHY[currentRole];
  const noChange = nextRole === currentRole;

  async function handleSubmit() {
    setServerError(null);
    setSubmitting(true);
    const result = await updateUserRole({ userId, role: nextRole });
    setSubmitting(false);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    toast.success(`Role updated to ${nextRole.toLowerCase()}.`);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change role for {userName}</DialogTitle>
          <DialogDescription>
            Update what this user can do in the admin app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={nextRole}
              onValueChange={(v) => setNextRole((v ?? currentRole) as Role)}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STAFF">Staff</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SUPERADMIN">Super admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isDowngrade && (
            <p className="rounded-md bg-amber-50 p-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
              This user will lose access to features above the {nextRole.toLowerCase()} level.
            </p>
          )}

          {serverError && (
            <p className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">
              {serverError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || noChange}
          >
            {submitting ? "Saving…" : "Save role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
