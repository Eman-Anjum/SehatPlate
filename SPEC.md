# SehatPlate

**An AI-powered food guide that scans local dishes and tells patients whether a meal is safe for their health condition, with simple tweaks to make it healthier.**

## Problem
Millions of people in Pakistan live with diabetes, kidney disease, and high blood pressure, yet most do not know whether everyday foods like biryani, nihari, haleem, daal chawal, or sweet chai are safe for them. Existing food and calorie apps are built around Western meals and do not understand local cuisine or condition-specific needs. Patients and families are left guessing, which can worsen their health.

## Solution
SehatPlate lets a user upload a photo of a dish (or type its name) and select their health condition. The AI identifies the dish, asks a few quick follow-up questions to handle differences in home recipes, and returns a clear verdict (Safe, Eat in Moderation, or Avoid) with a short reason and practical swaps.

## Target Users
- **Patients** managing diabetes, kidney disease, or hypertension
- **Family members and caregivers** checking meals for a parent or relative
- **Anyone** trying to eat healthier with local food

## Core Features

1. **AI Dish Scanner**
   Recognizes the dish from a photo or a typed name, with a focus on local cuisines like biryani, nihari, haleem, daal chawal, and chai.

2. **Multiple Conditions**
   Supports diabetes, kidney disease, high blood pressure, and more, so one app serves different patients and families.

3. **Smart Follow-up Questions**
   Asks quick, dish-specific and condition-specific questions such as "Does it have potatoes?", "How much oil?" or "Is the tea sweetened?" to handle recipes that differ from home to home.

4. **Clear Health Verdict**
   Rates the meal as Safe, Eat in Moderation, or Avoid, with a short reason in simple language.

5. **Healthy Swaps and Tips**
   Suggests practical changes like less salt, no potatoes for kidney patients, unsweetened tea for diabetics, and smaller portions.

6. **Trusted Guidelines and Safety**
   Bases advice on published WHO, ADA, and NKF guidelines, stays conservative when unsure, and always recommends consulting a doctor or dietitian.

## How It Works
1. User uploads a photo of the dish or types its name.
2. User selects their health condition (e.g. kidney disease).
3. AI identifies the dish and shows its best guess for confirmation.
4. AI asks 3 to 4 quick questions (potatoes, oil level, sugar, portion size).
5. AI combines the photo, answers, and the condition's guideline rules.
6. App shows a verdict, the reason, and healthy swaps.
7. A disclaimer reminds the user to consult a doctor or dietitian.

## Example Output
**Dish:** Chicken Biryani | **Condition:** Kidney disease
**Verdict:** 🟡 Eat in moderation
**Why:** Contains potatoes (high potassium) and is typically high in salt.
**Suggestions:** Ask for less salt, skip the potatoes, keep the portion small, add a cucumber salad.
*Guidance only. Please consult your doctor or dietitian.*

## Technical Approach
The implementation details (frontend, backend, and AI tools) will be decided during development based on what works best and fastest. At a high level, the system needs:
- A simple interface for uploading a photo or typing a dish name and choosing a condition
- An AI component that can recognize local dishes from images and reason about them using condition-specific guidelines
- A curated set of rules for popular Pakistani dishes and the supported conditions

## Safety and Limitations
- SehatPlate gives general guidance, not medical diagnosis or treatment.
- Recipes vary, so the app asks the user to confirm ingredients and adjusts its advice.
- Rules are based on published WHO, ADA, and NKF guidelines.
- When unsure, the app stays conservative and recommends consulting a doctor or dietitian.
- This is a prototype and has not yet been clinically validated.

## Why SehatPlate
- Understands local food that global apps ignore
- Personalized to the patient's condition, not just calories
- Follow-up questions make advice more accurate than a simple photo scan
- Simple verdicts that patients and families can understand instantly
- Works for a single user from day one, with no marketplace needed


## Future Scope
- Full Urdu voice and text support
- More dishes, regional cuisines, and conditions
- Validation with registered dietitians and clinical testing
- Meal history and weekly health insights
- Caregiver mode for managing a family member's diet
