---
status: approved
---

# Design brief: Reaction Baton Catch (default name)

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
I'm standing in front of an arc of 10 hanging batons. After a 3, 2, 1 countdown they fall one at a time in random order, 2 seconds apart, and I have to catch each one before it hits the floor.

## Why it belongs on glasses
- Uses: draws in the world, leaves your body free.
- Why it's better than the phone or laptop version: the batons stand in my room at real size, and I react to them with my hand while my eyes stay up, like a real reaction-ring training machine, without needing the 150 cm × 205 cm machine.

## Product or overlay
- Type: product. The batons and the game are the experience.
- What the real version would sense: nothing. A future version could detect the real floor so missed batons fall to it.
- Stand-in for the preview: a virtual floor plane about 160 cm below eye level (default) instead of the real floor.

## Where things live
- Where the user is looking during the main task: straight ahead at the arc of batons.
- Batons: 10 batons in an arc squeezed to fit the glasses' view, about 60 cm wide, about 100 cm in front of the user (default). They hang upright with their bottoms around chest height, a little below eye level (default). Each baton is 30 to 40 cm long and 2.5 to 4 cm thick, like a real reaction baton (35 cm × 3 cm used), placed at the start in front of the user and fixed in the world.
- Score, countdown, Start and Reset/Retry buttons: center-bottom, below the middle of the arc, at the same distance.
- Floor: a virtual floor plane about 160 cm below eye level (default). It can be invisible or faint; it only marks where a missed baton counts as dropped.

## Hands and input
- Catch: grab a falling baton (press and hold on it; a click in the preview). A grab before the baton crosses the floor counts as a catch.
- Start: button that starts the round.
- Reset: button that stops the round and puts all 10 batons back with the score at 0.
- Retry: button shown with the final score; starts a new round.
- Targets are big and highlight when aimed at. Each baton's grab area is a bit larger than the baton itself (default), so a thin falling baton is still catchable.
- One hand: the whole game is playable with one hand. Every catch and button press is a single-hand grab or pinch.
- Voice: none.

## When things show
- Batons: all 10 show hanging before the round; each disappears when caught or when it crosses the floor.
- Start button: shows before the round, hides once the round starts.
- Countdown: shows "3, 2, 1" (one number per second) after Start, in the center-bottom spot (default), then hides as the first baton drops.
- Score: shows during the round, going up by 1 for each catch.
- Final score and Retry button: show after all 10 batons have dropped.
- Reset button: available during the round (default).
- Catch and miss feedback: no sound or flash for now.
- If something needs attention out of view: none. Everything stays inside the view.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. When I click Start, a countdown appears going 3, 2, 1, and the first baton drops after it.
2. When I click a falling baton, it disappears and the score goes up by 1.
3. When I fail to catch a baton, it disappears when it crosses the floor and the score doesn't change.
4. After all batons have dropped, the final score shows along with a Retry button.

## Out of scope
- The fist-with-thumb-up hand pose. A standard grab is the catch.
- The full 180° half-circle around the player. The arc is squeezed into the view.
- Real floor (horizontal plane) tracking. Later version.
- Sound or flash feedback for catches and misses.
- Saving scores between sessions.
- A Snapchat phone version (holding the phone in one hand, playing with the other). Possible future version; this brief is Specs only.

## Risks and open questions
- Fall speed: batons fall 1.5× slower than real gravity (gravity divided by 1.5), so a drop to the floor takes roughly 0.6 seconds instead of 0.5. That may still be hard to catch with a mouse, so the fall speed should be a setting in the Inspector.
- Batons spaced about 6 cm apart at 1 m are small targets; the larger grab area helps.
- Feel unproven: how a grab-to-catch feels with real hand tracking at real fall speed.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.
- Baton drop order is random each round; 2 seconds between drops.
- When a baton is caught or crosses the floor, remove it so it no longer uses memory or updates (the learner asked for this for performance). Reset and Retry create a fresh set.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
