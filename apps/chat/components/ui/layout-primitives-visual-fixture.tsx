"use client";

import { InboxIcon } from "lucide-react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
/* oxlint-enable sort-imports */
import { Button } from "@/components/ui/button";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
/* oxlint-enable sort-imports */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
/* oxlint-disable react/jsx-no-literals -- LayoutPrimitivesVisualFixture renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, react/jsx-max-depth -- LayoutPrimitivesVisualFixture: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries */

export const LayoutPrimitivesVisualFixture = (): React.JSX.Element => (
  <main
    className="grid max-w-3xl gap-8 p-8"
    data-testid="layout-primitives-fixture"
  >
    <Card>
      <CardHeader>
        <CardTitle>Project overview</CardTitle>
        <CardDescription>Static card composition fixture.</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">
            Manage
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>Three active conversations.</CardContent>
      <CardFooter>Last updated just now</CardFooter>
    </Card>

    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>No conversations</EmptyTitle>
        <EmptyDescription>Start a chat to see it here.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>Start chat</Button>
      </EmptyContent>
    </Empty>

    <section className="flex flex-wrap gap-3">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button>Open alert</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project settings</DialogTitle>
            <DialogDescription>Dialog primitive fixture.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary">Open sheet</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Inspector</SheetTitle>
            <SheetDescription>Sheet primitive fixture.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </section>
  </main>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react/jsx-max-depth */
