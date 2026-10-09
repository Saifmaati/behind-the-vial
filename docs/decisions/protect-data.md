# Protective data (`data/protect.js`): decisions

Scope: `data/protect.js`, the protect research batch (`tools/.cache/research/raw-protect.json`) and the regenerated `research/*` and `data/sources.js`. One line each.

1. **The ledger was regenerated from both research files, `raw.json` then `raw-protect.json`.** The 845 earlier claims and the 227 earlier sources came out byte-identical. The result is 890 claims, 828 usable and 245 sources. Only protect-real-25 was dropped: its checker marked the AAP consumer site as a disallowed source.
2. **Not cited: the FDA warning letter that supports protect-real-08 and -09.** Its title names a seller, and #sources prints every cited title (see data-wording decision 7). This drops the "injections bypass the body's defenses" fact.
3. **Not cited: FDA's "How to Buy Medicines Safely From an Online Pharmacy" (protect-real-14).** Its title would put buying language into #sources, and the other rows already cover where real medicine comes from.
4. **Cited even though its title says "bought online": the Health Canada advisory (protect-real-20, -21, -22).** It is a national regulator. It is the only source that covers injectable peptides in general, and its title is a warning. The site already cites TGA's "Risks of buying peptide products online" in the same way.
5. **Not cited: the CDC HIV page (protect-dispose-18, -19) or the DEA Take Back Day page (-05, -07).** `build-sources.mjs` garbles their dates: "Version as of , restored …", and the undated DEA page gets the event date as its own date. The CDC page also carries a court-order banner warning that it may change. The "never share" message comes from the FDA-approved Zepbound label instead (-20).
6. **No Take Back Day date (October 24, 2026).** A static page would show it as upcoming after it has passed (claim note). The FDA's general take-back advice never goes stale.
7. **Left out: FDA's trash method (-09), the three-quarters-full detail (-15), "keep out of reach" and the mail-back steps (-04).** They read as handling instructions or as too much detail for teens. The steps send readers to an adult, a pharmacist or the local health department instead.
8. **"Tell a parent or another adult you trust" is `editorial: true`.** No regulator says it.
9. **The site's own advice is labelled "Our advice" inside the FDA-cited needle step: "leave it and tell an adult."** The checker on protect-dispose-16 asked for that label. FDA's own verbs (remove, bend, break or recap) are kept exactly.
10. **The checkers' corrections are applied throughout:**
    - "best", not "safest", and "most unused medicines" (-01);
    - "can be pharmacies or police stations" and "some have a drop box", not "many" (-02);
    - "made to resist needle pokes", not "can't poke through" (-12);
    - "depends on where you live" (-15);
    - "The FDA says patients should…", not "the safe way" (protect-real-04);
    - "GLP-1 medicines", not all weight-loss medicines (protect-real-16).
11. **The UK row covers only GLP-1 products and is labelled "(UK)", with no mixing wording.** protect-real-17 is UK-only: in the U.S., compounded GLP-1s may come in vials, and other legitimate medicines also come as powders.
12. **Zepbound is named as the approved label behind "never share needles or pens".** It is an example of a general rule, as its checker advised, and not guidance about retatrutide. Brand names of approved medicines are allowed (data-wording decision 10).
13. **Poison Help and 911 come from MedlinePlus (protect-real-23, -24) rather than the older Poison Help claim.** MedlinePlus explicitly includes injected poisonings and "don't wait for symptoms". "Toll-free" is shown as "free to call".
14. **"The FDA's review checks its quality" (real medicine) is inferred from protect-real-05.** That claim says unapproved versions skip the FDA's review for safety, effectiveness and quality.
15. **The "Retatrutide right now" row stays, even though PROTECT shows for every peptide.** Its label names retatrutide, and it is the clearest real-versus-internet contrast: no real version exists.
16. **Wording changes for the commerce test and for teen readers:**
    - MHRA's "bought" became "obtained";
    - Health Canada's "unauthorized" became "unapproved";
    - "psychological" and other jargon was avoided;
    - there are no digits outside the two helplines.

## Known gaps / for other owners

- None of the sources says whether take-back kiosks accept vials labelled "research use only". The take-back step quotes FDA advice for medicines. The adult and pharmacist steps cover the gap.
- `tools/build-sources.mjs`: a date note that contains its own date renders garbled, for example the CDC and DEA sources (date notes "Version as of , restored …" and "Undated page announcing the event (accessed …"). Neither source is cited, so nothing on screen is affected.
- `js/ui/protect.js` `stepIcon()`: step 7 ("Don't touch or share used needles.") matches no keyword, so it gets the fallback icon ("people").
- `data/sources.js` now also lists (uncited) the seller-named FDA warning letter and the FDA "How to Buy…" page, because the generator emits every usable source. It was already doing this for earlier letters (data-wording "Not in my files").
