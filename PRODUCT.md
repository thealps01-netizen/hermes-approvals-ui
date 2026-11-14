# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: the owner of a Hermes Desktop install. They do not need to be a programmer. During the
day the agent wants to write to its memory notes or to a skill; the owner looks at what it wants to
write and decides. They come to the panel between other work, often with nothing waiting.

## Product Purpose

Hermes can hold a memory or skill write for approval instead of saving it. This panel shows what is
waiting, why it arrived and what saving it would change, and it keeps every applied change
undoable. Success: the owner decides each change knowing what it does, and never loses text to a
change they did not read.

## Positioning

The decision always stays with the owner. A reviewer model reads each change and gives an opinion;
it never saves or rejects anything.

## Operating Context

- A page inside the Hermes Desktop app (route `/approvals`), opened from the sidebar, often in a
  split beside the chat. Pane widths run from 420 px to a full window.
- Three tabs, one level deep: Waiting (changes to decide), Memory (the notes and their size budget),
  Activity (everything saved, rejected or changed outside the panel, with Undo).
- The chat tells the owner a write is waiting; the panel is where they read it.

## Capabilities and Constraints

- Actions: save, don't save, later, review, review again, test a skill change, undo, restore,
  select several, fix a skill description, delete a memory note (two steps).
- The panel is drawn with the app's own UI kit and theme variables. The owner can change the app's
  theme, so the panel owns no colours and no font.
- The panel's text is English, one bundle. The reviewer's summary can be written in a language the
  owner chooses.
- The only model the panel calls is the reviewer the owner assigned.
- A destructive step takes two steps and says what cannot be undone.

## Brand Commitments

- Name: **Approvals**. It is part of Hermes, not a brand of its own.
- Voice: plain words, short sentences, says what will happen. "Don't save", not "Reject".

## Evidence on Hand

- Preview frames drawn from the panel's real output with invented notes: `tests/preview.png`,
  `tests/preview-light.png`, and `node tests/preview.mjs`.
- No user research, testimonials or usage numbers exist. Do not invent any.

## Product Principles

1. The owner decides; the panel informs.
2. The text of the change is the content. Everything else supports reading it.
3. Everything applied can be undone, and the panel says how.
4. Say what is happening in the background, in words.
5. An empty panel is a normal state, not an error.
