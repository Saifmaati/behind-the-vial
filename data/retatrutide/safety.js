// PeptideScope: retatrutide safety content: red flags (call 911 vs see a
// doctor today), what happens with too much, and warnings for the personal
// risk check.
//
// Every text-bearing object cites the sources of the fact-checked claims it
// uses (sources) and lists those claim ids (ledger, see research/LEDGER.md).
// Most warning signs come from labels of approved drugs in the same family,
// because retatrutide has no approved label anywhere; the text says so.
// Warnings only. Nothing here is a dose, an instruction to use the product,
// or a statement that anything is safe. An empty risk list means no usable
// claim maps that history to a warning; the UI says that does not mean safe.
// Check: node tools/trace.mjs data/retatrutide/safety.js

export default {
  redFlags: {
    call911: [
      {
        sign: "Swelling of the face, lips, tongue or throat, trouble breathing or swallowing, or fainting",
        why: "These can be signs of anaphylaxis, a severe allergic reaction. It can start within seconds or minutes, so there is no time to wait and see. Serious allergic reactions have been reported with tirzepatide, a related approved drug.",
        sources: ["u-s-2026-anaphylaxis-medlineplus-medical-encyclopedia", "eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["gap-red-flags-us-911-split-anaphylaxis-911", "gap-red-flags-us-911-split-anaphylaxis-fast-onset", "safety-allergy-anaphylaxis"],
      },
      {
        sign: "Chest pain or pressure, or a crushing or squeezing feeling in the chest, especially if it spreads to the jaw, left arm or between the shoulder blades",
        why: "These can be signs of a heart attack. Calling 911 is almost always the fastest way to get treatment, because the ambulance crew can start care as soon as they arrive.",
        sources: ["u-s-2026-chest-pain-medlineplus-medical", "american-heart-2024-symptoms-diagnosis-monitoring-arrhythmia", "american-heart-2024-warning-signs-heart-attack"],
        ledger: ["gap-red-flags-us-911-split-chest-pressure-911", "gap-red-flags-us-911-split-aha-arrhythmia-chest-pain-911", "gap-red-flags-us-911-split-aha-ambulance-not-drive"],
      },
      {
        sign: "A racing or pounding heart together with chest pain, passing out, trouble breathing, unusual sweating, or feeling dizzy or light-headed",
        why: "With any of these signs, a racing heart is an emergency. Retatrutide raises resting heart rate. In its phase 2 trial, the rise was bigger at higher doses.",
        sources: ["u-s-2026-heart-palpitations-medlineplus-medical", "new-england-2023-triple-hormone-receptor-agonist-2"],
        ledger: ["gap-red-flags-us-911-split-palpitations-plus-symptoms-911", "safety-heart-rate-retatrutide"],
      },
      {
        sign: "A drooping face, a weak arm, or slurred speech, even if it goes away",
        why: "These are signs of a stroke. The American Heart Association says to call 911 right away, even if the signs go away.",
        sources: ["american-heart-2024-symptoms-diagnosis-monitoring-arrhythmia"],
        ledger: ["gap-red-flags-us-911-split-afib-stroke-signs-911"],
      },
      {
        sign: "Fainting and not becoming alert again within a couple of minutes, or fainting with chest pain or a pounding or irregular heartbeat",
        why: "Also call 911 if the person who fainted has diabetes, is pregnant, is over age 50, or fell from a height. In the TRIUMPH-2 trial, low blood pressure, which can make you dizzy or faint, was more common on retatrutide than on the dummy shot (placebo).",
        sources: ["u-s-2025-fainting-medlineplus-medical-encyclopedia", "lancet-via-2026-retatrutide-adults-obesity-type"],
        ledger: ["gap-red-flags-us-911-split-fainting-911-list", "gap-red-flags-us-911-split-fainting-with-heart-symptoms-911", "safety-hypotension-retatrutide"],
      },
      {
        sign: "Someone collapses, has a seizure, has trouble breathing, or cannot be woken up",
        why: "US drug information for a related medicine says to call 911 right away for these signs after someone takes too much. If the heart has stopped, calling 911, starting CPR and using an AED (a portable shock machine) can save a life.",
        sources: ["u-s-2026-tirzepatide-injection-medlineplus-drug", "american-heart-2025-about-cardiac-arrest"],
        ledger: ["gap-red-flags-us-911-split-overdose-collapse-911", "gap-red-flags-us-911-split-collapse-cardiac-arrest-911"],
      },
      {
        sign: "Very low blood sugar with a seizure, passing out, not responding normally, or not being able to wake up",
        why: "When blood sugar drops very low, the brain can stop working as it should. If someone is passed out and no glucagon (an emergency sugar-raising medicine) is on hand, call 911 right away. Low blood sugar is more likely when these drugs are mixed with insulin or sulfonylurea pills.",
        sources: ["national-institute-2021-low-blood-glucose-hypoglycemia", "american-diabetes-2026-low-blood-glucose-hypoglycemia", "nhs-nhs-2023-low-blood-sugar-hypoglycaemia", "eli-lilly-2026-zepbound-tirzepatide-injection-prescribing"],
        ledger: ["gap-red-flags-us-911-split-niddk-severe-low-sugar", "gap-red-flags-us-911-split-ada-unconscious-911", "safety-redflag-911-severe-low-sugar", "gap-red-flags-us-911-split-low-sugar-risk-with-insulin"],
      },
      {
        sign: "Signs of losing too much body water (dehydration) together with passing out, confusion or a seizure",
        why: "Throwing up, diarrhea and nausea from these drugs can drain the body of fluid. MedlinePlus says to call 911 if a dehydrated person passes out at any point, becomes confused, or has a seizure.",
        sources: ["u-s-2025-dehydration-medlineplus-medical-encyclopedia", "eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["gap-red-flags-us-911-split-dehydration-911", "safety-dehydration-kidney"],
      },
      {
        sign: "Blood in your vomit, or vomit that looks like dark coffee grounds",
        why: "MedlinePlus says to call 911 or go to the emergency room for this. Do the same if you think the vomiting may be from poisoning.",
        sources: ["u-s-2025-nausea-vomiting"],
        ledger: ["gap-red-flags-us-911-split-vomiting-blood-911"],
      },
      {
        sign: "Sudden, sharp belly pain, a belly that is hard and stiff to the touch, or belly pain that comes with chest, neck or shoulder pain",
        why: "MedlinePlus says to get help right away or call 911 for these. Severe belly pain that will not go away, sometimes spreading to the back, can also be a sign of pancreatitis (an inflamed pancreas). Pancreatitis has happened with drugs in this family.",
        sources: ["u-s-2026-abdominal-pain-medlineplus-medical", "eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["gap-red-flags-us-911-split-sudden-sharp-belly-pain-911", "safety-pancreatitis-label"],
      },
      {
        sign: "Trouble breathing that comes on suddenly, or is so bad that it is hard to talk",
        why: "MedlinePlus says to call 911 or go to the emergency room. Trouble breathing can also be part of a severe allergic reaction.",
        sources: ["u-s-2025-breathing-difficulty-medlineplus-medical", "eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["gap-red-flags-us-911-split-sudden-breathing-trouble-911", "safety-allergy-anaphylaxis"],
      },
      {
        sign: "Someone has tried to end their life, or a life is in danger right now",
        why: "Call 911 right away, and do not leave the person alone, even after you have called. For thoughts of suicide, call or text 988.",
        sources: ["u-s-2025-suicide-suicidal-behavior-medlineplus", "national-institute-2026-suicide-prevention"],
        ledger: ["gap-red-flags-us-911-split-suicide-attempt-911", "gap-red-flags-us-911-split-nimh-988-vs-911"],
      },
    ],
    doctorToday: [
      {
        sign: "Severe belly pain that will not go away, with or without throwing up, sometimes spreading to your back",
        why: "This can be a sign of pancreatitis (an inflamed pancreas). It has happened with drugs in this family, and some cases reported after these drugs went on sale ended in death. The tirzepatide guide says to stop the drug and call a doctor right away. If the pain is sudden and sharp, call 911.",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection-prescribing", "eli-lilly-2026-zepbound-tirzepatide-injection", "u-s-2026-abdominal-pain-medlineplus-medical"],
        ledger: ["gap-red-flags-us-911-split-label-pancreatitis-stop-call", "safety-pancreatitis-label", "gap-red-flags-us-911-split-sudden-sharp-belly-pain-911"],
      },
      {
        sign: "Upper belly pain, especially pain lasting several hours, with fever, chills, yellow skin or eyes, tea-colored pee, or pale, clay-colored poop",
        why: "These can be signs of a gallbladder problem. Gallbladder problems happen a bit more often on these drugs, and the tirzepatide label links them to weight loss itself. Blocked bile ducts that go untreated can kill.",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection-prescribing", "national-institute-2017-symptoms-causes-gallstones", "eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["gap-red-flags-us-911-split-label-gallbladder-right-away", "gap-red-flags-us-911-split-niddk-gallbladder-attack-doctor", "safety-gallbladder-rates-and-cause"],
      },
      {
        sign: "Throwing up for more than a day, not being able to keep any liquids down for 12 hours or more, or throwing up 3 or more times in one day",
        why: "Losing this much fluid can hurt your kidneys. The tirzepatide guide says to tell your doctor right away if nausea, vomiting or diarrhea will not go away.",
        sources: ["u-s-2025-nausea-vomiting", "eli-lilly-2026-zepbound-tirzepatide-injection-prescribing"],
        ledger: ["gap-red-flags-us-911-split-vomiting-doctor-today", "gap-red-flags-us-911-split-no-urine-8h-doctor-today", "gap-red-flags-us-911-split-label-dehydration-kidney"],
      },
      {
        sign: "Not peeing for 8 hours or more, peeing much less than usual, or very dark pee",
        why: "These can be signs of dehydration or kidney trouble. With tirzepatide, a related drug, fluid loss has led to kidney problems, sometimes bad enough to need dialysis (a machine that cleans the blood).",
        sources: ["u-s-2025-nausea-vomiting", "u-s-2026-acute-kidney-failure-medlineplus", "nhs-nhs-2026-dehydration", "eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["gap-red-flags-us-911-split-no-urine-8h-doctor-today", "gap-red-flags-us-911-split-urine-slows-stops-provider", "safety-redflag-emergency-dehydration", "safety-dehydration-kidney"],
      },
      {
        sign: "Feeling dizzy or light-headed when you stand up, and it does not stop",
        why: "This can be a sign of dehydration or of low blood pressure. In the TRIUMPH-2 trial, low blood pressure was more common on retatrutide than on the dummy shot (placebo).",
        sources: ["nhs-nhs-2026-dehydration", "lancet-via-2026-retatrutide-adults-obesity-type"],
        ledger: ["safety-redflag-emergency-dehydration", "safety-hypotension-retatrutide"],
      },
      {
        sign: "A racing or pounding heart at rest that lasts several minutes, a resting pulse over 100 beats a minute without exercise, nerves or fever, or heart flutters that are new or feel different",
        why: "Drugs in this family can raise your heart rate, even at rest. The Wegovy guide says to tell your doctor if your heart races or pounds for several minutes. If it comes with chest pain, passing out or trouble breathing, call 911.",
        sources: ["novo-nordisk-2026-wegovy-semaglutide-prescribing-information", "u-s-2026-heart-palpitations-medlineplus-medical"],
        ledger: ["gap-red-flags-us-911-split-wegovy-guide-racing-several-minutes", "gap-red-flags-us-911-split-resting-pulse-over-100-doctor-today", "gap-red-flags-us-911-split-new-palpitations-doctor-today", "gap-red-flags-us-911-split-palpitations-plus-symptoms-911"],
      },
      {
        sign: "Shakiness, sweating, dizziness, confusion, blurry vision or a fast heartbeat, which can mean low blood sugar",
        why: "Low blood sugar is more likely when these drugs are mixed with insulin or sulfonylurea pills. If the signs do not get better after eating something sugary, get a ride to the emergency room. Do not drive yourself.",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection-prescribing", "nhs-nhs-2026-tirzepatide-medicine-manage-type", "u-s-2026-low-blood-sugar-medlineplus"],
        ledger: ["gap-red-flags-us-911-split-low-sugar-signs-include-fast-heartbeat", "gap-red-flags-us-911-split-low-sugar-risk-with-insulin", "safety-redflag-urgent-111", "gap-red-flags-us-911-split-low-sugar-not-improving-er"],
      },
      {
        sign: "Redness, itching, swelling or pain where the shot went in that bothers you or does not go away",
        why: "Reactions where the shot goes in are common, and in the TRIUMPH-1 trial they became more common at higher doses. Australia's medicines regulator warns that injected products made in dirty or non-sterile conditions can cause infections. The NHS says to talk to a pharmacist or doctor if a side effect bothers you or does not go away.",
        sources: ["new-england-2026-retatrutide-triple-hormone-receptor-3", "therapeutic-goods-2026-tga-tests-counterfeit-retatrutide", "nhs-nhs-2026-semaglutide-medicine-manage-type"],
        ledger: ["gap-phase3-serious-ae-rates-and-heart-rate-t1-injection-site", "gap-gray-contaminant-sterility-data-tga-nonsterile-infection-anaphylaxis", "gap-side-effect-mechanism-and-mitigation-fatigue-nhs-common-and-when-to-ask"],
      },
      {
        sign: "Thoughts of suicide, new or worse depression, or unusual changes in your mood or behavior",
        why: "Call or text 988 any time. It is free and confidential. The FDA also says to tell your health care professional about these changes.",
        sources: ["u-s-2026-fda-requests-removal-suicidal-2", "988-lifeline-2026-988-suicide-crisis-lifeline"],
        ledger: ["gap-red-flags-us-911-split-fda-still-report-mood-988", "safety-988-lifeline"],
      },
    ],
  },
  tooMuch: {
    intro: "Retatrutide is not approved anywhere, so there is no official US patient guide for it. The signs below come from approved drugs that work in a similar way. Retatrutide also stays in the body a long time. Its half-life, the time it takes for the amount in the blood to fall by half, is about 6 days. And people who buy vials sold as retatrutide may get much less or much more drug than they think, without knowing it.",
    signs: [
      {
        text: "Severe nausea and severe vomiting. The US label for Wegovy, a related drug, lists these as effects of overdoses with drugs in this family.",
        sources: ["novo-nordisk-2026-wegovy-semaglutide-injection"],
        ledger: ["safety-overdose-label-wegovy"],
      },
      {
        text: "Severely low blood sugar. Signs include shakiness, sweating, dizziness, confusion, blurry vision, slurred speech and a fast heartbeat.",
        sources: ["novo-nordisk-2026-wegovy-semaglutide-injection", "eli-lilly-2026-zepbound-tirzepatide-injection-prescribing"],
        ledger: ["safety-overdose-label-wegovy", "gap-red-flags-us-911-split-low-sugar-signs-include-fast-heartbeat"],
      },
      {
        text: "Belly pain, fainting, headache, migraine and dehydration (losing too much body water). The FDA got reports like these after some people using vials of compounded semaglutide, a related drug, injected five to 20 times the intended amount by mistake.",
        sources: ["u-s-2024-fda-alerts-health-care"],
        ledger: ["safety-overdose-fda-symptoms", "safety-overdose-fda-compounded-errors"],
      },
      {
        text: "Pancreatitis (an inflamed pancreas) and gallstones were also reported in those cases. Some people needed medical care or a hospital stay.",
        sources: ["u-s-2024-fda-alerts-health-care"],
        ledger: ["safety-overdose-fda-symptoms", "gap-red-flags-us-911-split-fda-vial-dosing-error-harms"],
      },
      {
        text: "Signs of severe dehydration: little or no pee, very dark pee, confusion, dizziness, a fast heartbeat and fast breathing.",
        sources: ["u-s-2025-dehydration-medlineplus-medical-encyclopedia"],
        ledger: ["gap-red-flags-us-911-split-severe-dehydration-signs"],
      },
    ],
    whatToDo: [
      {
        text: "Call Poison Control at 1-800-222-1222 right away, or go to the nearest emergency room. US drug guides for related medicines say to do this if someone takes too much. The call is free, and poison experts answer any time, day or night.",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection-prescribing", "america-s-2026-glucagon-like-peptide-1"],
        ledger: ["gap-red-flags-us-911-split-overdose-poison-help-er", "safety-poison-help-line"],
      },
      {
        text: "Call 911 right away if the person collapses, has a seizure, has trouble breathing, or cannot be woken up.",
        sources: ["u-s-2026-tirzepatide-injection-medlineplus-drug"],
        ledger: ["gap-red-flags-us-911-split-overdose-collapse-911"],
      },
      {
        text: "If you need to go to the emergency room, get a ride. Do not drive yourself. Bring the packaging and any of the product that is left.",
        sources: ["nhs-nhs-2026-tirzepatide-medicine-manage-type"],
        ledger: ["safety-overdose-nhs-111"],
      },
      {
        text: "The effects may not pass quickly. For tirzepatide, with a half-life of about 5 days, the US label says a period of watching and treatment may be needed. Semaglutide stays in the blood for about 5 to 7 weeks after the last shot, so an overdose may need a long period of care.",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection", "novo-nordisk-2026-wegovy-semaglutide-injection"],
        ledger: ["safety-overdose-label-zepbound", "safety-overdose-label-wegovy"],
      },
    ],
    sources: ["eli-lilly-2026-what-know-about-retatrutide", "u-s-2026-fda-s-concerns-unapproved-2", "lancet-elsevier-2022-ly3437943-novel-triple-gip", "wiley-drug-2026-composition-labelling-accuracy-products"],
    ledger: ["safety-retatrutide-not-approved", "gap-red-flags-us-911-split-retatrutide-no-label", "pk-half-life-6-days", "gray-dar-unknowing-dose"],
  },
  risk: {
    "heart-rhythm": [
      {
        organ: "heart",
        title: "It raises your heart rate",
        text: "Retatrutide raises resting heart rate. In its phase 2 trial, the rise was bigger at higher doses, peaked around week 24, and then came down. In the larger TRIUMPH-1 trial, heart rate was highest at about week 20 in the 9 mg and 12 mg groups.",
        sources: ["new-england-2023-triple-hormone-receptor-agonist-2", "new-england-2026-retatrutide-triple-hormone-receptor-3"],
        ledger: ["safety-heart-rate-retatrutide", "gap-phase3-serious-ae-rates-and-heart-rate-t1-pulse-peaked-week20"],
      },
      {
        organ: "heart",
        title: "Rhythm problems were reported more often in a small trial",
        text: "In the phase 2 trial, heart-rhythm problems were reported in 7 of 62 people (11%) in the 12 mg group, versus 2 of 70 (3%) on placebo (a dummy shot). Most were mild to moderate. The groups were small, and one middle group had the highest rate (5 of 35 people).",
        sources: ["new-england-2023-triple-hormone-receptor-agonist-3"],
        ledger: ["safety-arrhythmia-retatrutide-phase2"],
      },
      {
        organ: "heart",
        title: "Some people stopped because of an irregular heartbeat",
        text: "In TRIUMPH-2, 3 people in the 9 mg group (1.1%) stopped treatment because of atrial fibrillation, a type of irregular heartbeat. Serious or severe rhythm problems happened in 7 of 284 people (2%) in that group, versus 1 of 287 on placebo.",
        sources: ["eli-lilly-2026-triumph-2-easd-2026"],
        ledger: ["gap-phase3-serious-ae-rates-and-heart-rate-t2-afib-discontinuation", "gap-phase3-serious-ae-rates-and-heart-rate-t2-arrhythmia-serious"],
      },
      {
        organ: "heart",
        title: "Related drugs call for heart-rate checks",
        text: "For semaglutide, a related approved drug, the US label says heart rate should be checked regularly, a racing heart at rest should be reported, and the drug should be stopped if resting heart rate stays up. We found no source with specific advice for people who already have a heart-rhythm problem.",
        sources: ["novo-nordisk-2026-wegovy-semaglutide-injection"],
        ledger: ["safety-history-heart-rhythm", "safety-heart-rate-wegovy-label"],
      },
    ],
    pancreatitis: [
      {
        organ: "pancreas",
        title: "Pancreatitis has happened with this drug family",
        text: "Pancreatitis is a swollen, inflamed pancreas. It has happened with drugs in this family, and some cases reported after the drugs went on sale ended in death. The warning sign is severe belly pain that will not go away and may spread to the back, with or without throwing up.",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["safety-pancreatitis-label"],
      },
      {
        organ: "pancreas",
        title: "Too few cases to know the risk for retatrutide",
        text: "In TRIUMPH-1, an expert panel confirmed pancreatitis in 4 of 582 people in the 12 mg group, 3 of 583 in the 9 mg group and 1 of 584 in the 4 mg group, versus 2 of 586 on placebo. The researchers said there were too few cases to tell whether retatrutide raises the risk. Lipase, a pancreas enzyme, also rose in the blood on retatrutide. A higher level on its own does not mean someone has pancreatitis.",
        sources: ["new-england-2026-retatrutide-triple-hormone-receptor-3", "new-england-2026-supplementary-appendix-retatrutide-triple"],
        ledger: ["gap-phase3-serious-ae-rates-and-heart-rate-t1-pancreatitis", "gap-phase3-serious-ae-rates-and-heart-rate-t1-pancreatitis-too-few", "gap-phase3-serious-ae-rates-and-heart-rate-t1-lipase-rise"],
      },
      {
        organ: "pancreas",
        title: "People with past pancreatitis were left out of the trials",
        text: "People who had ever had pancreatitis were kept out of the main retatrutide trials, including TRIUMPH-1, TRIUMPH-2, TRIUMPH-3 and the phase 2 trial. So these trials cannot show how retatrutide affects people with this history. The NHS says tirzepatide, a related drug, may not be suitable for people who have had acute pancreatitis.",
        sources: ["nhs-nhs-2026-tirzepatide-medicine-manage-type", "clinicaltrials-gov-2023-study-ly3437943-participants-who"],
        ledger: ["safety-history-pancreatitis", "safety-history-phase2-exclusions"],
      },
    ],
    gallbladder: [
      {
        organ: "gallbladder",
        title: "Fast weight loss can cause gallstones",
        text: "Losing weight quickly overloads bile, the digestive juice stored in the gallbladder, with cholesterol. It also makes the gallbladder squeeze less, so stones can form. In TRIUMPH-1, serious or severe gallbladder and bile-duct problems happened in 10 of 584 people (1.7%) in the 4 mg group, 5 of 583 (0.9%) in the 9 mg group and 4 of 582 (0.7%) in the 12 mg group, versus 4 of 586 (0.7%) on placebo.",
        sources: ["dove-medical-2026-adverse-events-associated-incretin", "new-england-2026-retatrutide-triple-hormone-receptor-3"],
        ledger: ["safety-gallbladder-mechanism", "gap-phase3-serious-ae-rates-and-heart-rate-t1-gallbladder-serious"],
      },
      {
        organ: "gallbladder",
        title: "Watch for gallbladder pain",
        text: "For people with past gallbladder disease, a 2026 review advises watching for gallbladder symptoms that do not go away, like belly pain, and getting them checked quickly. The retatrutide phase 2 trial kept out people whose gallbladder disease caused symptoms. Signs of trouble include upper belly pain, fever, yellow skin or eyes, and pale, clay-colored poop.",
        sources: ["dove-medical-2026-adverse-events-associated-incretin", "clinicaltrials-gov-2023-study-ly3437943-participants-who", "eli-lilly-2026-zepbound-tirzepatide-injection-prescribing"],
        ledger: ["safety-history-gallbladder", "safety-history-phase2-exclusions", "gap-red-flags-us-911-split-label-gallbladder-right-away"],
      },
    ],
    "thyroid-mtc": [
      {
        organ: "thyroid",
        title: "Related drugs carry a thyroid tumor warning",
        text: "In rats, tirzepatide, a related approved drug, caused thyroid C-cell tumors (growths in one type of thyroid cell). No one knows if this happens in people. Because of this, people who have had medullary thyroid cancer, whose family members have had it, or who have MEN 2 must not use tirzepatide.",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["safety-thyroid-boxed-warning"],
      },
      {
        organ: "thyroid",
        title: "This history kept people out of the main trial",
        text: "TRIUMPH-1 kept out anyone with a personal or family history of medullary thyroid cancer, or MEN 2. So the trial cannot show how retatrutide affects people with this history.",
        sources: ["clinicaltrials-gov-2026-study-retatrutide-ly3437943-particip"],
        ledger: ["safety-history-mtc-men2"],
      },
      {
        organ: "thyroid",
        title: "Neck signs to tell a doctor about",
        text: "The tirzepatide label lists a lump or swelling in the neck, a hoarse voice, trouble swallowing, or shortness of breath as possible signs of thyroid cancer to tell a doctor about.",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["safety-redflag-next-visit-thyroid-vision"],
      },
    ],
    pregnancy: [
      {
        organ: "blood",
        title: "Related drugs may harm an unborn baby",
        text: "The label for tirzepatide, a related drug, says it may harm an unborn baby. In animal studies it caused smaller babies and birth abnormalities, and there is not enough human data to know the risk. Weight loss is not recommended during pregnancy.",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["safety-pregnancy-label"],
      },
      {
        organ: "blood",
        title: "Not studied in pregnancy or breastfeeding",
        text: "TRIUMPH-2, TRIUMPH-3 and the phase 2 trial kept out women who were pregnant or breastfeeding, or planning to be. So these trials cannot show what retatrutide does during pregnancy or to a baby.",
        sources: ["eli-lilly-2025-protocol-j1i-mc-gzbk", "clinicaltrials-gov-2023-study-ly3437943-participants-who"],
        ledger: ["gap-personal-history-trial-exclusions-pregnancy-breastfeeding", "safety-history-phase2-exclusions"],
      },
      {
        organ: "blood",
        title: "It stays in the body for weeks",
        text: "Retatrutide's half-life is about 6 days. In Lilly's phase 2 obesity trial, women who could get pregnant had to keep using birth control for 2 months after their last injection. The UK medicines regulator says not to use GLP-1 medicines while pregnant, trying to get pregnant, or breastfeeding.",
        sources: ["lancet-elsevier-2022-ly3437943-novel-triple-gip", "eli-lilly-2022-protocol-j1i-mc-gzbg", "medicines-healthcare-2026-glp-1-medicines-weight"],
        ledger: ["pk-half-life-6-days", "gap-surgery-pregnancy-practical-guidance-reta-protocol-women-2-months", "safety-pregnancy-washout-mhra"],
      },
    ],
    "diabetes-meds": [
      {
        organ: "blood",
        title: "Higher chance of low blood sugar",
        text: "In TRIUMPH-2, a trial in people with type 2 diabetes, low blood sugar was more common in people also taking a sulfonylurea: 4 of 76 people (5.3%) in the 12 mg group had a clinically important low, versus 1 of 74 (1.4%) on placebo. The guide for tirzepatide, a related drug, says the risk is higher with insulin or a sulfonylurea.",
        sources: ["eli-lilly-2026-triumph-2-easd-2026", "eli-lilly-2026-zepbound-tirzepatide-injection-prescribing"],
        ledger: ["gap-phase3-serious-ae-rates-and-heart-rate-t2-hypoglycemia-sulfonylurea", "gap-red-flags-us-911-split-low-sugar-risk-with-insulin"],
      },
      {
        organ: "blood",
        title: "Not a replacement for insulin",
        text: "The UK medicines regulator warned that diabetic ketoacidosis, a dangerous build-up of acid in the blood, was reported in people with type 2 diabetes whose insulin was cut down or stopped too quickly when they started a GLP-1 drug. It says these drugs are not a replacement for insulin.",
        sources: ["medicines-healthcare-2026-glp-1-medicines-weight"],
        ledger: ["safety-history-insulin-type1-dka"],
      },
      {
        organ: "blood",
        title: "A serious case with an online product",
        text: "In a 2026 case report, a man with type 1 diabetes got severe vomiting, diarrhea, very high ketone levels and kidney injury two days after injecting an online product sold as retatrutide. He had missed insulin doses and also had a gut infection, and the product was never tested, so the cause is not certain.",
        sources: ["cureus-springer-2026-online-sourced-retatrutide-complicating"],
        ledger: ["safety-dka-type1-retatrutide-case"],
      },
      {
        organ: "blood",
        title: "The diabetes trial left out insulin users",
        text: "TRIUMPH-2 kept out people who had used insulin, other than briefly, in the 3 months before joining, and anyone with a severe low-blood-sugar episode in the past 6 months. TRIUMPH-3, a trial in people with heart disease, did allow insulin.",
        sources: ["eli-lilly-2025-protocol-j1i-mc-gzbk", "diabetes-obesity-2025-retatrutide-treatment-obesity-obstruct-3"],
        ledger: ["gap-personal-history-trial-exclusions-triumph2-no-insulin-hypos", "gap-personal-history-trial-exclusions-triumph3-t2d-and-insulin-allowed"],
      },
    ],
    kidney: [
      {
        organ: "kidneys",
        title: "Fluid loss can hurt the kidneys",
        text: "Throwing up, diarrhea and nausea can drain the body of fluid, and that can hurt the kidneys. With tirzepatide, a related drug, there have been reports of sudden kidney failure, or long-term kidney failure getting worse, sometimes needing dialysis (a machine that cleans the blood).",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["safety-dehydration-kidney", "safety-history-kidney"],
      },
      {
        organ: "kidneys",
        title: "Serious kidney problems were seen in the main trial",
        text: "In TRIUMPH-1, serious or severe sudden kidney problems happened in 2 of 584 people (0.3%) in the 4 mg group and 2 of 582 (0.3%) in the 12 mg group, and in no one on placebo.",
        sources: ["new-england-2026-retatrutide-triple-hormone-receptor-3"],
        ledger: ["gap-phase3-serious-ae-rates-and-heart-rate-t1-acute-renal"],
      },
      {
        organ: "kidneys",
        title: "Badly reduced kidney function was not studied",
        text: "Every TRIUMPH trial kept out people with an eGFR under 30. eGFR is a blood-test score that estimates how well the kidneys filter blood. The phase 2 trial kept out people with an eGFR under 45.",
        sources: ["diabetes-obesity-2025-retatrutide-treatment-obesity-obstruct-3", "clinicaltrials-gov-2023-study-ly3437943-participants-who"],
        ledger: ["gap-personal-history-trial-exclusions-kidney-egfr-under-30", "safety-history-phase2-exclusions"],
      },
    ],
    "diabetic-eye": [
      {
        organ: "eyes",
        title: "Eye damage can get worse when blood sugar drops fast",
        text: "In people with type 2 diabetes who already have diabetic eye disease (retinopathy), it can get worse for a while when high blood sugar is brought down quickly. The tirzepatide label says people with this history should be watched for it getting worse, and that people with type 2 diabetes should tell a doctor about any change in their vision.",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["safety-retinopathy", "safety-redflag-next-visit-thyroid-vision"],
      },
      {
        organ: "eyes",
        title: "Retatrutide brings blood sugar down",
        text: "In a phase 2 trial in people with type 2 diabetes, the 12 mg group lowered HbA1c, a 3-month average of blood sugar, by about 2 percentage points after 24 weeks.",
        sources: ["lancet-elsevier-2023-retatrutide-gip-glp-1"],
        ledger: ["pk-glucose-hba1c-phase2-t2d"],
      },
    ],
    mood: [
      {
        organ: "brain",
        title: "People with recent mental illness were left out of the trials",
        text: "All TRIUMPH trials kept out people with unstable major depression or another severe mental illness in the past 2 years, and anyone who had ever attempted suicide or was actively suicidal. So the trials cannot show how retatrutide affects people with this history.",
        sources: ["diabetes-obesity-2025-retatrutide-treatment-obesity-obstruct-3"],
        ledger: ["gap-personal-history-trial-exclusions-unstable-depression-2y-all", "gap-personal-history-trial-exclusions-suicide-attempt-ever"],
      },
      {
        organ: "brain",
        title: "Tell someone about mood changes",
        text: "For related GLP-1 drugs, the FDA says to tell a health care professional about new or worse depression, suicidal thoughts, or any unusual changes in mood or behavior. You can call or text 988 any time. It is free and confidential.",
        sources: ["u-s-2026-fda-requests-removal-suicidal", "988-lifeline-2026-988-suicide-crisis-lifeline"],
        ledger: ["safety-mood-fda-removed-warning", "safety-988-lifeline"],
      },
    ],
    surgery: [
      {
        organ: "stomach",
        title: "Food can stay in the stomach",
        text: "Retatrutide slows how fast the stomach empties. In an early study, the slowing was strongest after the first shot and got weaker with later shots. With related drugs, food left in the stomach during surgery or deep sedation can get breathed into the lungs.",
        sources: ["diabetes-obesity-2023-novel-gip-glp-1", "eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["pk-onset-gastric-emptying-first-dose", "pk-gastric-emptying-fades", "safety-aspiration-anesthesia"],
      },
      {
        organ: "lungs",
        title: "Breathing in stomach contents has happened",
        text: "The US label for tirzepatide, a related drug, reports rare cases where people on these drugs breathed stomach contents into their lungs during anesthesia or deep sedation, even though they said they had fasted as told. It says there is not enough data to know whether changing fasting rules or pausing the drug lowers this risk.",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["gap-surgery-pregnancy-practical-guidance-fda-label-aspiration-reports", "gap-surgery-pregnancy-practical-guidance-fda-label-insufficient-data"],
      },
      {
        organ: "stomach",
        title: "No set time to stop it before surgery",
        text: "Retatrutide has no approved label and no set time to stop it before surgery. For once-weekly drugs, the American Diabetes Association says a one-week pause is likely not enough, and the right length is unknown. Joint advice from medical groups in 2024 says it may need to change for newer triple drugs like retatrutide.",
        sources: ["therapeutics-clinical-2026-medication-safety-perioperative-r", "american-diabetes-2026-16-diabetes-care-hospital", "surgical-endoscopy-2024-multi-society-clinical-practice"],
        ledger: ["gap-surgery-pregnancy-practical-guidance-reta-no-cessation-interval", "gap-surgery-pregnancy-practical-guidance-ada2026-one-week-insufficient", "gap-surgery-pregnancy-practical-guidance-ms2024-not-for-triple-agonists"],
      },
      {
        organ: "lungs",
        title: "Tell every doctor, dentist and anesthesia team",
        text: "UK regulators warn doctors that people who bought these drugs for cosmetic weight loss may not mention them unless asked directly. Tell every doctor, dentist and anesthesia doctor before any procedure. Your instructions before the procedure, or the way you are put to sleep, may need to change.",
        sources: ["mhra-uk-2025-glp-1-dual-gip", "medicines-healthcare-2026-glp-1-medicines-weight", "eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["gap-surgery-pregnancy-practical-guidance-mhra-may-not-disclose", "gap-surgery-pregnancy-practical-guidance-mhra-public-tell-team", "safety-aspiration-anesthesia"],
      },
    ],
    gastroparesis: [
      {
        organ: "stomach",
        title: "It slows the stomach further",
        text: "Retatrutide slows how fast the stomach empties, most of all after the first shot. The label for tirzepatide, a related drug, says it is not recommended for people with severe gastroparesis.",
        sources: ["diabetes-obesity-2023-novel-gip-glp-1", "eli-lilly-2026-zepbound-tirzepatide-injection"],
        ledger: ["pk-onset-gastric-emptying-first-dose", "safety-history-gastroparesis"],
      },
      {
        organ: "stomach",
        title: "Not studied in people with a slow stomach",
        text: "TRIUMPH-2 and TRIUMPH-3 kept out people with a known serious stomach-emptying problem, such as severe gastroparesis. So these trials cannot show how retatrutide affects people with this condition.",
        sources: ["eli-lilly-2025-protocol-j1i-mc-gzbk"],
        ledger: ["gap-personal-history-trial-exclusions-gastroparesis"],
      },
      {
        organ: "stomach",
        title: "Stomach side effects are common",
        text: "In TRIUMPH-2, nausea affected 28% of people in the 12 mg group versus 8% on placebo, and diarrhea affected 34% versus 13%.",
        sources: ["lancet-via-2026-retatrutide-adults-obesity-type"],
        ledger: ["safety-gi-retatrutide-triumph2-peer-reviewed"],
      },
    ],
    "birth-control": [
      {
        organ: "stomach",
        title: "The pill may work less well with a related drug",
        text: "Tirzepatide, a related drug, can make birth-control pills work less well because it slows the stomach. In its pill study, one tirzepatide shot lowered peak hormone levels from the pill by about 55% to 66%. US and UK advice for tirzepatide is to switch to a non-pill method, or to add a barrier method such as condoms.",
        sources: ["eli-lilly-2026-zepbound-tirzepatide-injection", "medicines-healthcare-2026-glp-1-medicines-weight"],
        ledger: ["safety-birth-control-pill", "gap-surgery-pregnancy-practical-guidance-fda-zepbound-oc-data", "gap-surgery-pregnancy-practical-guidance-mhra-oc-barrier-tirzepatide"],
      },
      {
        organ: "stomach",
        title: "No public answer for retatrutide",
        text: "Lilly ran a study of whether retatrutide changes blood levels of a combined birth-control pill. It finished in July 2024, but as of October 2026 no results had been posted and no paper had been found. So whether retatrutide makes the pill less reliable is not publicly known.",
        sources: ["clinicaltrials-gov-2024-phase-1-study-investigate"],
        ledger: ["gap-surgery-pregnancy-practical-guidance-reta-oc-ddi-no-results"],
      },
      {
        organ: "stomach",
        title: "In the trials, the pill alone was not enough",
        text: "In TRIUMPH-2 and TRIUMPH-3, women who could get pregnant and were sexually active with men had to use two kinds of birth control at the same time. The pill counted as one, but a second method, such as condoms with spermicide, was also needed.",
        sources: ["eli-lilly-2025-protocol-j1i-mc-gzbk"],
        ledger: ["gap-personal-history-trial-exclusions-oral-contraceptive-not-alone", "gap-personal-history-trial-exclusions-contraception-two-methods"],
      },
    ],
    "moles-melanoma": [],
    "eating-disorder": [
      {
        organ: "brain",
        title: "Experts are concerned about harm and misuse",
        text: "Experts are concerned that appetite-lowering GLP-1 drugs could cause harm or be misused by some people with eating disorders, and say careful assessment is needed. There is little research on this so far.",
        sources: ["elsevier-psychiatric-2025-use-potential-abuse-glucagon"],
        ledger: ["safety-history-eating-disorder"],
      },
      {
        organ: "brain",
        title: "It lowers appetite",
        text: "In TRIUMPH-4, decreased appetite was reported as a side effect by 19.0% of people in the 9 mg group and 18.2% in the 12 mg group, versus 9.4% on placebo. Some people stopped treatment because they felt they had lost too much weight.",
        sources: ["eli-lilly-2025-lilly-s-triple-agonist"],
        ledger: ["safety-appetite-mechanism-and-rate", "safety-dropout-retatrutide-triumph4"],
      },
      {
        organ: "brain",
        title: "Trial doctors could turn people away",
        text: "In the retatrutide trial plans, study doctors could turn away people whose condition might make the trial unsafe for them. A diagnosed eating disorder was one of the examples named.",
        sources: ["eli-lilly-2025-protocol-j1i-mc-gzbk"],
        ledger: ["gap-personal-history-trial-exclusions-eating-disorder-alcohol-drugs"],
      },
    ],
  },
};
