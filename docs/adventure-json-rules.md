# Adventure JSON Rules

This project uses one adventure file per scenario.

The player display is map-first. The GM reads descriptive narration aloud, while
the shared player screen only shows maps, handouts, and live token positions.

The file must be valid JSON encoded in UTF-8 and should follow these rules.

## Top-level object

The root object must contain:

- `id`: stable machine-readable identifier
- `title`: player-safe adventure title
- `subtitle`: short GM-facing descriptor for the scenario
- `audioLibrary`: reusable library of local music, ambience, and sfx tracks
- `characters`: reusable player character cards for the whole adventure
- `scenes`: ordered array of scenes

Example:

```json
{
  "id": "death-house",
  "title": "Death House",
  "subtitle": "Local GM station with a dedicated player display",
  "audioLibrary": [],
  "characters": [],
  "scenes": []
}
```

## Identifier rules

Use lowercase ASCII identifiers with hyphens for file-level ids and scene ids.

Good:

- `death-house`
- `upper-hall`
- `secret-stairs`

Avoid:

- spaces
- Cyrillic
- punctuation other than `-`
- changing an id after handouts or links depend on it

## Scene object

Each scene must contain:

- `id`: unique scene id inside the adventure
- `title`: scene label
- `location`: short place label
- `accent`: one of `ember`, `gold`, `teal`
- `gmSummary`: short private summary for the GM
- `gmNotes`: hidden GM-only operating notes
- `map`: map definition for the scene
- `handouts`: array of revealable handouts
- `checksClues`: GM table of checks and clue outcomes
- `monsterBlocks`: array of GM-only monster or NPC stat blocks
- `recommendedAudio`: array of track ids from `audioLibrary`
- `objectives`: array of short GM goals for the scene

Example:

```json
{
  "id": "foyer",
  "title": "The Foyer",
  "location": "Ground Floor",
  "accent": "gold",
  "gmSummary": "First interior room after the party commits to entering.",
  "gmNotes": "Lock the doors after the party commits.",
  "map": {
    "id": "foyer-map",
    "title": "Foyer Map",
    "placeholder": "Upload the foyer battle map here."
  },
  "handouts": [],
  "checksClues": [],
  "monsterBlocks": [],
  "recommendedAudio": ["foyer-drone"],
  "objectives": [
    "Create the locked-in feeling.",
    "Introduce the first social beat."
  ]
}
```

## Audio track object

Each `audioLibrary` item must contain:

- `id`: unique track identifier
- `title`: visible library label
- `kind`: one of `music`, `ambience`, `sfx`
- `src`: audio path or data URL

Example:

```json
{
  "id": "foyer-drone",
  "title": "Foyer Drone",
  "kind": "music",
  "src": "audio/foyer-drone.mp3"
}
```

## Player character object

`characters` stores player character cards shared by the whole adventure, not by
an individual scene.

Cards can be imported from Long Story Short character JSON. The importer reads
the outer `jsonType: "character"` wrapper and parses the nested `data` string.

Good content:

- player character stats, skills, saves, attacks, HP, AC, and speed
- personality, equipment, goals, notes, and spellcasting sections
- portrait or avatar image

These cards may be linked to player tokens, but their authored data should stay
at the adventure level.

## Map object

Each map object must contain:

- `id`: unique map identifier
- `title`: short GM-facing label
- `placeholder`: fallback text for the player screen if no image is loaded yet

Optional:

- `imageSrc`: default map image path or data URL

## Handout object

Each handout must contain:

- `id`: unique identifier inside the adventure
- `title`: short visible title
- `caption`: short label like `Handout`, `Letter`, `Clue`
- `body`: player-visible text

Optional:

- `imageSrc`: image path or data URL

## Monster block object

Each `monsterBlocks` item is GM-only and follows the familiar 5e stat block
shape.

Required fields:

- `id`
- `name`
- `subtitle`
- `imageSrc`
- `armorClass`
- `hitPoints`
- `speed`
- `strength`
- `dexterity`
- `constitution`
- `intelligence`
- `wisdom`
- `charisma`
- `savingThrows`
- `skills`
- `senses`
- `languages`
- `challenge`
- `traits`
- `actions`
- `bonusActions`
- `reactions`
- `legendaryActions`
- `notes`

Each rules section like `traits` or `actions` is an array of entries with:

- `id`
- `title`
- `body`

Optional:

- `imageSrc`: portrait or token-style image path/data URL for the GM card and quick token creation

## Check / clue entry object

Each `checksClues` item is a single GM-facing row with:

- `id`
- `ability`
- `difficulty`
- `outcome`

## Writing rules by field

### `gmSummary`

This is a private one-line summary for the GM.

It should answer:

- what this scene is for
- why it exists in the flow
- what kind of reveal is likely here

### `gmNotes`

This is operational text for the GM only.

Good content:

- when to switch the player display mode
- what to conceal
- what trigger should fire next
- pacing notes
- optional safety notes

### `map`

This field defines the player-facing tactical or exploration board for the
scene.

Rules:

- one main map per scene for the current MVP
- if you do not yet have the image, still write the `placeholder`
- use the map for visible movement and token display

### `handouts`

Only include material that may be shown directly on the shared player screen.

Good content:

- letters
- diary pages
- drawings
- discovered clues
- item cards

### `monsterBlocks`

These are only for the GM screen.

Good content:

- enemy stat blocks
- NPC fallback combat stats
- custom reactions and encounter notes
- boss legendary actions

### `checksClues`

Use this table for skill checks, saves, passive notices, or any clue gate the GM
may want to scan quickly during play.

Good content:

- `Perception / DC 14 / A hidden latch is visible in the bookcase`
- `Arcana / DC 15 / The sigils suppress sound within the room`
- `Passive Perception 13 / The floorboards shift near the fireplace`

### `audioLibrary`

This is the reusable soundtrack library for the whole adventure.

Rules:

- keep tracks at the top level so multiple scenes can reuse them
- use `kind` to separate score, ambience, and one-shot effects
- `src` may be a relative project path or a data URL exported from the editor

### `recommendedAudio`

This is a scene hint list for the GM, not an autoplay rule.

Use it to mark which tracks fit the active scene best.

### `objectives`

These are quick GM reminders, not lore notes.

## Conversion rules from GM scene notes

When converting a master scene write-up into JSON:

1. Split the adventure into map or reveal beats.
2. Make one JSON scene per beat, room, or reveal unit.
3. Keep descriptive read-aloud text in your GM source, not on the player screen.
4. Convert scene purpose into `gmSummary`.
5. Move hidden explanations and pacing instructions into `gmNotes`.
6. Convert visible letters, notes, and clue cards into `handouts`.
7. Add any clue gates or checks to `checksClues`.
8. Add any GM-only NPC or enemy stats to `monsterBlocks`.
9. Add reusable soundtrack entries to `audioLibrary`.
10. Tag scene-specific tracks in `recommendedAudio`.
11. Define one `map` block for the shared board.
12. Convert the room purpose into `objectives`.

## What not to put into this file yet

For the current MVP, do not store:

- battle rules
- branching state machines
- fog of war geometry
- private per-player information

Live token positions are runtime state and may be stored separately from the
authored adventure JSON.
