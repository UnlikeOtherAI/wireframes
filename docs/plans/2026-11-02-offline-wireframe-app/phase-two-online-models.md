# Phase two: accounts and online models

Not being built yet. Phase one, the offline app, ships without any of this and needs no account.

## Problem Statement

Someone unhappy with the local model, or who does not want a 3 GB download, has no alternative.

## Current Behavior

The app runs Gemma on the device and has no accounts or network features beyond the model download.

## Desired Behavior

- The app works fully offline with no account. An account is only asked for when someone chooses an online model.
- Two online models sit beside the local one: **super cheap** and **super good**, the more capable of the two.
- Credits are bought through in-app purchase, and the balance shows in the app.
- An empty balance explains itself.

## Design

- **Identity** comes from the existing single sign-on service, which stays the only authority. The app stores a stable subject and a rotating refresh token in the Keychain, and no profile data or passwords.
- **Models** are reached through the existing model proxy, with no provider key in the app.
- **Credits** are rated from real token cost, with a markup that covers store commission. The markup is configuration, so it can change without a release.
- **Generation** goes behind the same interface as the local model, so the edit protocol, validation and undo do not change.

## Implementation Order

1. Native login.
2. One proxied model call with test credits.
3. Purchases and the balance.
4. The model switcher in the chat.
5. Google Play with the Android app.

## Edge Cases

- A refund after the credits are spent: online models stop until the balance is topped up.
- A restored or replayed purchase grants credits once.
- Offline or signed out with an online model selected: use the local model if installed, and say so.
- A balance running out mid-generation: no partial edit, and the design is unchanged.

## Non-Goals

- Local accounts or passwords.
- Credit grants or metering on the device.
- Bring-your-own API keys.
