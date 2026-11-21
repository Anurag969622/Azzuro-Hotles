# 🎙️ Azzurro Insights — Live Screen Recording Walkthrough Script

This script is designed for an authentic, human-paced live demonstration (via Loom, Zoom, or local screen recording) to present the completed **Azzurro Insights** platform to company leadership and stakeholders.

---

## ⏱️ Video Overview
* **Target Duration:** 4 – 5 minutes
* **Resolution:** 1080p full screen (90%–100% browser zoom recommended)
* **Tone:** Natural, confident, clear, and direct — like an engineer walking through a live product demo.

---

### Step 1: Introduction (0:00 – 0:30)
> **🖥️ Screen Action:**  
> Start on the main **Overview** dashboard (`http://localhost:5173/`). Move your mouse naturally over the top bar and sidebar navigation.

**🗣️ What you say:**  
> *"Hey everyone! Thanks for tuning in. Today I want to walk you through the finished build for the **Azzurro Insights** platform.*  
>  
> *The main goal here was simple: take the headache out of tracking guest reviews across all four Sydney properties, get rid of all dummy and test data, and build a system that pulls in real Booking.com reviews, sorts them out properly, and shows you exactly what guests love and what needs fixing."*

---

### Step 2: Overview Dashboard & Numbers (0:30 – 1:05)
> **🖥️ Screen Action:**  
> Slowly scroll down the Overview page. Hover your cursor over the top rating score, the weekly trend, and the sentiment breakdown.

**🗣️ What you say:**  
> *"So right here on the home screen, you get a clean bird’s-eye view of how the portfolio is doing.*  
>  
> *Up top, we’ve got our current week’s average rating and the review volume, compared directly against the previous week. You can see right away whether guest satisfaction is trending up or slipping.*  
>  
> *Down here, the sentiment breakdown splits feedback into positive, neutral, and negative. The important thing to note: every single number you see here is calculated straight from actual guest reviews stored in our database. There’s zero mock data or placeholder numbers anywhere."*

---

### Step 3: Checking Individual Properties (1:05 – 1:45)
> **🖥️ Screen Action:**  
> Click **Properties** on the left menu (`/properties`). Scroll through the 4 cards. Click on **Azzurro Pod Hotel Potts Point**.

**🗣️ What you say:**  
> *"If we jump over to the **Properties** tab, each hotel has its own dedicated breakdown.*  
>  
> *We have all four venues here: Central Sydney, Potts Point, Olympic Hotel Paddington, and Chateau de Venus Darling Harbour.*  
>  
> *For each one, you can see their exact review count, their live average rating, and how their positive-to-negative feedback stacks up. If you click into any property — like Potts Point here — you get their localized performance so you don't have reviews from different hotels getting mixed together."*

---

### Step 4: The Core Feature: Reviews Explorer & Filter Demo (1:45 – 2:50)
> **🖥️ Screen Action:**  
> 1. Click **Reviews** on the left menu (`/reviews`).  
> 2. Click the **Property dropdown** in the filter bar.  
> 3. Select **"Azzurro Pod Hotel Potts Point"** — pause for 1 second as the card and reviews load.  
> 4. Point your cursor at the review names (*Heikkilä, Shann, etc.*) and the category ratings (*Staff 7.8, Cleanliness 7.1*).  
> 5. Switch the dropdown to **"Olympic Hotel Paddington"** — show the reviews update to *Gerardo, Farkhondeh, Lynn*.  
> 6. Switch back to **"All 4 Properties"**.  
> 7. Click the search bar, type `cleanliness` or `staff`, and hit Enter to show instant search.

**🗣️ What you say:**  
> *"Now let's check out the **Reviews Explorer**, which is where operations teams will probably spend most of their time.*  
>  
> *Earlier, we had an issue where selecting different properties kept showing the exact same reviews. That’s now completely fixed.*  
>  
> *Watch what happens when I switch the filter to **Potts Point**:*  
> *Right away, the scorecard updates with Potts Point's real Booking.com category ratings — Staff, Cleanliness, Comfort, Value for money. And down here in the feed, you see actual guest verbatims with their real names, ratings, and room details.*  
>  
> *Now if I switch over to **Olympic Hotel Paddington**, everything swaps instantly — new scorecard, and reviews specifically from Paddington guests.*  
>  
> *And if I choose **All 4 Properties**, it brings all the reviews together in one master feed. You can also search for anything specific — like typing 'cleanliness' or 'noise' — or filter by sentiment and score band."*

---

### Step 5: AI Insights & Operational Priorities (2:50 – 3:35)
> **🖥️ Screen Action:**  
> Click **AI Insights** on the left menu (`/insights`). Scroll through the priority cards (High, Medium, Low). Click one card to show the review snippet underneath.

**🗣️ What you say:**  
> *"Next up is **AI Insights**.*  
>  
> *Instead of having your managers read through hundreds of reviews one by one, our backend runs language processing to tag and categorize every comment automatically into operational topics — things like Staff Behaviour, Noise, Wi-Fi, or Check-in.*  
>  
> *Then it ranks them by urgency based on how often an issue comes up and how badly it hurts the review score. So if there's a recurring maintenance or cleanliness issue at a specific location, management sees it highlighted right here with actual guest quotes as proof, so they can fix it before it hurts the hotel's Booking.com ranking."*

---

### Step 6: Background Automation & Database Setup (3:35 – 4:10)
> **🖥️ Screen Action:**  
> 1. Click **Collection Monitor** on the left menu (`/collection`).  
> 2. Point out the scheduled jobs and the live collection logs.  
> 3. Point at the green status badges at the bottom of the sidebar (**Local AI Worker: ACTIVE**, **Supabase Pool: READY**).

**🗣️ What you say:**  
> *"Under the hood, this entire pipeline runs automatically.*  
>  
> *Over in the **Collection Monitor**, you can see our automated background scheduler. It’s set up on Sydney local time to run daily updates across each property.*  
>  
> *We built it with job locking and retry handling, meaning if one property's network has a hiccup, it won't crash the other three. Everything saves directly to our cloud database on **Supabase** with full deduplication so duplicate reviews are never saved twice.*  
>  
> *And as you can see from the status badges in the bottom corner, both our Express backend and the local AI engine are connected and running live."*

---

### Step 7: Wrap-up (4:10 – 4:30)
> **🖥️ Screen Action:**  
> Click back to the **Overview** dashboard and let the screen settle.

**🗣️ What you say:**  
> *"So to wrap things up: the platform is completely clean, all mock data has been removed, reviews are accurately separated by hotel with real guest data, and the automation is running smoothly in the background.*  
>  
> *Everything is tested, committed, and ready for deployment. Thanks so much for watching, and I'd love to hear your thoughts or answer any questions you have!"*

---

## 💡 Practical Recording Tips
1. **Steady Pace:** Pause naturally after switching dropdowns or loading pages so the viewer can see the live transition.
2. **Tab Pre-check:** Before starting your recording, ensure your local dev server (`npm run dev`) and Express server (`node src/index.js`) are running.
3. **Audio:** Use a clean microphone or headset and close background apps.
