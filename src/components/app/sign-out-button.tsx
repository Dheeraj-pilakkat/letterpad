"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/components/auth/auth-provider";
import { buttonVariants } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
      className={buttonVariants("outline", "sm")}
    >
      <LogOut size={14} /> Sign out
    </button>
  );
}
