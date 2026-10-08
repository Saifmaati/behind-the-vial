# Product brief (as given by the project owner, 2026-10-07)

PROJECT: "PeptideScope". An educational web app that shows, visually, what
happens inside the human body after someone injects a peptide that is going
viral on social media. Audience: regular people who see these on TikTok and
Instagram, not clinicians. Goal: a premium, futuristic, medical-grade visual
experience that makes the biology and the risks obvious and real. Education
only. It must never function as a dosing or injection guide.

SETUP AND DEPLOY. Public GitHub repo, GitHub Pages, live URL at the top of the
README. Keep the stack light and dependency-minimal. Use only properly licensed
free and open-source assets, and record each asset's license in the repo.

INTRO. The landing sequence is cinematic, premium, and futuristic: dark,
clinical, high contrast, a slow orchestrated reveal with a realistic syringe and
glowing vasculature, tasteful motion that respects reduced-motion settings. It
should feel expensive and serious, then hand the visitor a clear way into the
app.

CORE EXPERIENCE, the interactive body.
- A near 1:1 translucent human body built from a free, correctly licensed
  open-source anatomical model. It should look like real medical visualization,
  not a cartoon.
- The user picks a peptide, then taps the injection site: abdomen, thigh, or
  upper arm.
- A realistic syringe delivers it under the skin. Then, in sequence: the depot
  forming under the skin, slow absorption into the capillaries, entry into the
  bloodstream with realistic blood flow, and distribution to the organs that
  peptide acts on.
- A timeline the user can scrub: onset (when it starts working), peak, and
  clearance (how long to leave the body), using the compound's real
  pharmacology.
- As the timeline plays, each side effect appears at the organ it comes from,
  with a short "why it happens" and "how to reduce it or when it passes."

CONTENT PER PEPTIDE. Status (approved, in trials, or research-chemical only),
what it is, how it works, onset/peak/duration, side effects with their
mechanisms, red flags split into call-911 vs see-a-doctor-today, how strong the
human evidence is (anecdote, animal, small human, large trial), and a "creator
claims vs. evidence" fact check. Retatrutide is the full first entry. Scaffold
as "coming soon": semaglutide, tirzepatide, cagrilintide, tesamorelin,
CJC-1295, ipamorelin, sermorelin, BPC-157, TB-500, GHK-Cu, melanotan II,
melanotan I, PT-141, MOTS-c, SS-31, epitalon, Semax, Selank, thymosin alpha-1,
KPV.

GRAY-MARKET REALITY. A section showing independent lab tests of vials bought
online, some well under label, some over, some containing none of the drug.
Core message: with these products you cannot know how much you are actually
getting.

PERSONAL RISK CHECK (warnings only). The user can tick relevant history (heart
rhythm problems, past pancreatitis, gallbladder issues, family history of
medullary thyroid cancer, pregnancy, diabetes medication, many moles for the
tanning peptides, and so on). The body highlights the specific risks that
history raises for the selected peptide. It only ever shows warnings. It never
tells the person they are safe or cleared, and it never outputs a dose.

HARD EXCLUSIONS. Do not build these under any framing.
- No dose calculator, dose slider, or "enter weight/gender/bloodwork to get a
  dose" feature.
- No personalized dosing, mg-per-kg, titration schedules, or injection-amount
  recommendations.
- No "safe dose" zones or any control where the user sets their own dose.
- Cover "what happens if you take too much" through overdose and warning signs,
  when to get help, and the fact that gray-market doses are unknowable. Present
  dose-response only as fixed, cited trial facts (the studied dose arms, and
  how side effects and dropouts rose with dose), never as an interactive dial.

SOURCING. Only authoritative sources: Eli Lilly trial releases, NEJM and other
peer-reviewed journals, FDA, national drug regulators, Public Citizen, and
independent vial-testing data. Cite every factual claim with a visible source.
Mark anything that cannot be verified. Do not invent numbers.

CRAFT. Premium and educational in feel. Works on mobile and desktop, light and
dark. Keyboard accessible, readable contrast, honors reduced-motion. Fast to
load. Persistent disclaimer: educational only, not medical advice, no dosing
guidance, talk to a clinician. "Pharmacist review: pending" marker in the
footer.

DELIVERABLE. A live, deployed first draft, with a README listing the URL, what
is finished, and what is stubbed.
