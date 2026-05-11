"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deactivateUser,
  reactivateUser,
  type UserListItem,
} from "@/lib/actions/user";
import { cn } from "@/lib/utils";

import { ChangeRoleDialog } from "./ChangeRoleDialog";
import { CreateUserDialog } from "./CreateUserDialog";

const ROLE_LABELS: Record<UserListItem["role"], string> = {
  STAFF: "Staff",
  ADMIN: "Admin",
  SUPERADMIN: "Super admin",
};

interface Props {
  users: UserListItem[];
  currentUserId: string;
}

export function UsersTable({ users, currentUserId }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<UserListItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleDeactivate(u: UserListItem) {
    if (
      !window.confirm(
        `Deactivate ${u.name}? Their sessions will end immediately and they won't be able to sign in until reactivated.`,
      )
    ) {
      return;
    }
    setPendingId(u.id);
    const result = await deactivateUser({ userId: u.id });
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${u.name} deactivated.`);
    router.refresh();
  }

  async function handleReactivate(u: UserListItem) {
    setPendingId(u.id);
    const result = await reactivateUser({ userId: u.id });
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${u.name} reactivated.`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>Add user</Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              const isInactive = u.deactivatedAt !== null;
              const isBusy = pendingId === u.id;
              return (
                <TableRow
                  key={u.id}
                  className={cn(isInactive && "text-muted-foreground")}
                >
                  <TableCell
                    className={cn("font-medium", isInactive && "opacity-70")}
                  >
                    {u.name}
                    {isSelf && (
                      <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        you
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-muted-foreground",
                      isInactive && "opacity-70",
                    )}
                  >
                    {u.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(isInactive && "opacity-60")}
                    >
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isInactive ? (
                      <Badge
                        variant="outline"
                        className="border-muted-foreground/30 text-muted-foreground"
                      >
                        Inactive
                      </Badge>
                    ) : u.mustChangePassword ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-700"
                      >
                        Must change password
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString("en-ZA")}
                  </TableCell>
                  <TableCell className="text-right">
                    {isSelf ? null : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isBusy}
                              aria-label={`Actions for ${u.name}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setRoleTarget(u)}
                            disabled={isInactive}
                          >
                            Change role
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {isInactive ? (
                            <DropdownMenuItem
                              onClick={() => handleReactivate(u)}
                            >
                              Reactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleDeactivate(u)}
                              className="text-destructive focus:text-destructive"
                            >
                              Deactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      {roleTarget && (
        <ChangeRoleDialog
          open={roleTarget !== null}
          onOpenChange={(o) => {
            if (!o) setRoleTarget(null);
          }}
          userId={roleTarget.id}
          userName={roleTarget.name}
          currentRole={roleTarget.role}
        />
      )}
    </div>
  );
}
