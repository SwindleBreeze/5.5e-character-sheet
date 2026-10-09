# 5etools-format fixture

A tiny, hand-written data tree in the 5etools file layout (`tree/`, named so the `data/` ignore
rule does not catch it), used by the importer tests. Every name, source and rule text here is
invented. Sources: `TST` (a made-up 2024-style book) and `OLD` (a made-up 2014-style book).

`homebrew/` holds two invented homebrew files in the 5etools homebrew format (`_meta.sources`
and record arrays), on top of `TST`: `HearthGuide` (a class with a subclass, a species, a
subrace of a `TST` species, a background, a feat, spells and items, with some sloppy fields on
purpose) and `BrutePaths` (a subclass of a `TST` class, a dependency that isn't there, and a
record claiming the `TST` source).
