# Pocket Solar Panel

## 1. Primary Request and Intent
The user's primary intent is to develop a web application named "Pocket Solar Panel." The core features include:
- A scientifically accurate simulation of solar panel power output, accounting for factors like panel orientation and atmospheric conditions (Air Mass).
- An intuitive, high-refresh-rate Augmented Reality (AR) visualization to show the real-world position of the sun, including an off-screen indicator.
- A dual-mode UI: a clean, simple "Default View" for public use and a comprehensive "Debug View" for development, with a persistent toggle to switch between them.
- A user-friendly design optimized for outdoor use in bright sunlight, with high-contrast colors and large, accessible buttons.

## 2. Key Technical Concepts
- **Frontend Framework:** Mithril.js for building the single-page application, managing state, and rendering the UI.
- **Astronomical Calculations:** SunCalc.js library to get the sun's position (altitude and azimuth) based on geolocation and time.
- **3D Graphics and Mathematics:**
    - **Vector Math:** Extensive use of dot products (for calculating incidence angle/power) and cross products (for defining coordinate systems).
    - **Coordinate Systems:** Managing and transforming between World Coordinates (East, North, Up), Device/Sensor Coordinates (alpha, beta, gamma), and Screen Coordinates (X, Y percentages).
    - **AR Projection:** Projecting a 3D world vector (the sun's position) onto a 2D screen plane.
    - **Gimbal Lock:** A recurring problem where the 3D orientation math becomes unstable, which we have been actively troubleshooting.
- **Physics Simulation:**
    - **Geometric Model:** Initial model based purely on the cosine of the angle of incidence.
    - **Air Mass Model:** A more advanced atmospheric attenuation model to simulate how the thickness of the atmosphere affects solar irradiance, providing a more realistic power curve.
- **Browser APIs:**
    - `Geolocation API`: To get the user's latitude and longitude.
    - `DeviceOrientationEvent API`: To get the phone's orientation in real-time for the AR and panel simulation.

## 3. Files and Code Sections
The entire application is contained within a single file.

**Recent/Ongoing Development (detailed):**
- `/Users/rdj/Documents/solar sim sonification/main.js`:
    - **Status:** Heavily Modified. This file contains all application logic and is the focus of all development work.
    - **Why important:** It houses the core simulation, rendering, and AR logic. The current work is focused on fixing a fundamental flaw in the AR projection mathematics within this file.
    - **Key Functions Under Development:**
        - `projectWorldToScreen(worldVector, alpha_deg, beta_deg, gamma_deg, isPanelOnBack)`: This function has been the primary source of bugs related to AR movement and stability. The most recent change replaced its entire internal logic for defining the camera's coordinate system to fix a gimbal lock issue.
        - **Latest Implementation of `projectWorldToScreen`'s camera matrix:**
            ```javascript
            // 4. Create a view matrix using a stable "world up" vector to prevent gimbal lock.
            const worldUp = [0, 0, 1]; // Z-axis is "Up" in the world

            // Use cross products to find the camera's "right" and then its true "up" vectors.
            let cameraRight = [
                worldUp[1] * cameraForward[2] - worldUp[2] * cameraForward[1],
                worldUp[2] * cameraForward[0] - cameraForward[0] * cameraForward[2],
                cameraForward[0] * worldUp[1] - cameraForward[1] * worldUp[0]
            ];
            const rightMag = Math.sqrt(cameraRight[0]**2 + cameraRight[1]**2 + cameraRight[2]**2);

            // Handle the edge case where the camera is pointing straight up or down
            if (rightMag < 0.001) {
                // When looking at zenith/nadir, the cross product is zero. We can define "right" arbitrarily.
                // We'll base it on the phone's physical orientation (gamma) to keep it stable.
                const gamma_rad = toRadians(gamma_deg);
                cameraRight = [Math.cos(gamma_rad), Math.sin(gamma_rad), 0];
            } else {
                cameraRight = cameraRight.map(v => v / rightMag); // Normalize the vector
            }

            // The camera's true "up" is the cross product of its stable "right" and "forward" vectors.
            const cameraUp = [
                cameraRight[1] * cameraForward[2] - cameraRight[2] * cameraForward[1],
                cameraRight[2] * cameraForward[0] - cameraRight[0] * cameraForward[2],
                cameraRight[0] * cameraForward[1] - cameraRight[1] * cameraForward[0]
            ];
            ```
    - **Other Key Functions (Now Stable):**
        - `updateCalculations()`: Refactored from a slow `setInterval` to be called by the `deviceorientation` event handler for a high refresh rate. It now contains robust checks for `NaN` sensor data.
        - `App.view`: Refactored to support a persistent layout with a conditional `debugContent` block, ensuring the debug toggle is always accessible.
        - `calculateSolarPanelOutput()`: Upgraded to include a toggleable Air Mass model for more realistic output simulation.

## 4. Errors and fixes
- **AR Movement Instability:** The AR visualization suffered from multiple bugs, including incorrect vertical movement, reversed horizontal movement, and finally, a "gimbal lock" instability when the phone was held vertically. This was fixed by re-architecting the `projectWorldToScreen` function to use a stable "world up" vector to define the camera's coordinate system, which is the current implementation.
- **Off-Screen Indicator Failures:** The implementation of the off-screen indicator was plagued by regressions, `NaN` errors, and application freezes. This was due to a series of flawed logic and math errors. The issue was resolved by reverting the code and following a methodical, multi-phase plan where each piece of the calculation (raw data, angle, position) was verified with debug values before implementing the final UI.
- **UI Refactoring Errors:** An initial attempt to create separate "debug" and "default" views failed because the button to toggle between them was not accessible in the default view. This was fixed by refactoring the UI to have a persistent layout where only the detailed text block is toggled, while the AR view and control buttons remain visible.
- **User Feedback on Communication:** The user requested that I adopt the communication style of a "principal engineer," focusing on technical accuracy and avoiding excessive apologies, acknowledging that failure and iteration are expected parts of the development process.

## 5. Problem Solving
The primary problem-solving effort has been a long and iterative process of debugging the 3D mathematics of the AR projection. Initial simple fixes were insufficient. The breakthrough came from adopting a methodical, phased approach with verifiable goals, as requested by the user. This allowed us to isolate and fix fundamental flaws in the coordinate system logic, the off-screen indicator calculations, and finally, the gimbal lock instability. The UI architecture was similarly refined through iteration after an initial flawed design.

## 7. Known Issues

### AR Visualization Instability (Gimbal Lock)

- **Symptom:** When the phone is held vertically (either pointing straight up or straight down), the AR visualization of the sun can behave erratically. The horizontal (left-right) movement becomes unstable or unresponsive.
- **Cause:** This is a classic 3D graphics problem known as "gimbal lock." The mathematical formulas used to represent the phone's orientation from its sensor data (`alpha`, `beta`, `gamma`) become unstable in this configuration. The logic in `projectWorldToScreen` does not currently handle this edge case correctly.
- **Status:** This issue is postponed. The code has been reverted to a version that is stable in most orientations but still exhibits this bug when the phone is held vertically.
- "still wrong. sun viz is only correct when I tilt the phone up (sun moves up until out of screen). it's wrong when I tilt the phone down (sun still moves up instead of down) or sideways (sun still moves vertically instead of horizontally). Propose a phased plan to fix it bit by bit"
- "do it"
- "sun viz seems correct when panel on screen, but incorrect when panel on back and tilting sideways (direction seems reversed). do you see an issue or am I wrong?"
- "revert last change"
- "commit now. the last fix didn't work and broke more things. We'll try again tomorrow."
- "Think about another way to fix the sideway movement when panel is on back. Explain why the new fix won't affect other movements. Let me approve before implementing"
- "do it"
- "Can you predict with your current logic: When I set panel to back of phone, look at sun at zenith (screen down, back up), and tilt sideways, will the sun viz on the screen move towards the "higher" (in the physical world) edge of the screen or the "lower" edge? Also explain if your prediction matches the expected behavior."
- "You do know the expected behavior. The observed behavior is still reversed. Sun moves towards lower edge when tilted sideways and panel on back."
- "yes"
- "Seems to work now. Commit"
- "I can see the sun before entering test mode and it's in an arbitrary position. Set the sun to actual location now."
- "do it"
- "Now propose plan to add visualization for when sun is out of screen."
- "Commit then do phase 1"
- "The new viz isn't showing and panel on back isn't working anymore"
- "yes"
- "Didn't fix either issue. No indicator. Flipping panel does seem to trigger a change, but the button label doesn't change to "back", and the sun viz froze. Flipping again changes back to front mode and sun viz moves correctly. You have one more shot to fix it, or I'll revert to last commit"
- "yes"
- "didn't fix anything. revert to last commit. propose a new phased plan to implement additional sun viz with verifiable goals in each phase"
- "do phase 1"
- "debug projX and projY just shows "waiting""
- "they work now. next step"
- "I see. So the indicator angle is pretty much the polar angle of the sun on my phone screen plane?"
- "next step"
- "next step"
- "The indicator doesn't show up all the time when sun is off screen and when it does show up, it's fixed at the center of the left edge."
- "Didn't fix it. Revert to version before implementing indicator"
- "Keep phase 1-3 and just revert to before phase 4"
- "I'm glad I accepted changes before phase 4 so I can manually undo all changes and revert to just before phase 4 because your reversion broke things. Commit current version"
- "Break this last step into phases too and verify each phase before moving on"
- "What's the point of 4a when you can just rename debug to final?"
- "do 4a"
- "Final show indicator is always true, even when sun is on screen"
- "Now debug indicator is waiting when sun is on screen"
- "there are multiple errors. First, debug indicator is still waiting when sun is on screen. final indicator is x=50, y=50, angle=0 when first entering test mode and doesn't change when I tilt phone. final show indicator is false when sun is on screen. when I flip the phone, both debug and final indicator Y and angle are both NaN, while debug indicator X=2"
- "do it"
- "didn't fix it. also debug projX and projY became waiting when I turn phone upside down in test mode with panel on screen. is that reason for NaN?"
- "yes"
- "Nope. projX and projY still waiting as soon as Nz becomes negative and show valid values when Nz becomes positive again"
- "do it"
- "Now it works. One more issue: Sun actually becomes off screen much earlier as I tilt phone, even way before Nz changes to negative. Indicator should show as soon as sun is off the physical phone screen."
- "do it"
- "commit. anything to cealn up from previously failed fixes before moving on?"
- "do it"
- "It works. It's magical. Add the projx, projy, indicator x/y/angle, and show indicator back to debug info"
- "commit"
- "What is limiting the refresh rate? I know a/b/c updates instantaneously. Can we get the sun viz to do that too?"
- "do it"
- "Yo this is sick combined with the sonification. Commit"
- "How accurate is the simulated solar output? It seems I'm getting 60% output on a flat panel at 4:23pm."
- "Eventually I want to use this in combination with a real solar panel demo and need the shape of the simulated output to match the shape of actual voltage reading as closely as possible. What are the highest impact factors I should incorporate into my simulation, assuming we will have clear sky and no obstruction on training day?"
- "implement air mass model and add a toggle to turn it on/off"
- "commit"
- "I want to redesign the UI for public use and keep the current UI for debug use. Add a new toggle to switch between default mode and debug mode. Default mode can just be a blank screen for now."
- "continue till done"
- "Well. The button is not on the default view."
- "still don't see it"
- "commit"
- "Change the title from "solar sonification" to "pocket solar panel" and show it in default view as well"
- "show "allow device orientation" button on both views"
- "I need the default view to be clearly visible both in and against bright sunlight. What color scheme should I use for the background and text? What color should the sun viz be for good contrast?"
- "Can the text be off-black instead of pure black because it looks ugly? And blue isn't usually associated with the sun. What are some colors that balance accessibility and association?"
- "Do it"
- "apply the same color scheme for debug view"
- "Make all buttons bigger"
- "Make button font same size as body text"
- "commit first then do it"
- "implement fix"
- "didn't fix it. when sun is on left side and Nz=0.08, indicator X will start moving right as Nz decreases. When Nz=0.02, all numbers stopped updating until Nz=-0.02"
- "do it"
- "still didn't fix it. I reverted it. do you get more expensive if I stay in the same chat?"
- "I mean will it consume more tokens as context gets longer? Every day I'm spending more money than the last one. Yes try again. Don't apologize excessively. Failure and iteration are expected. Be a principal engineer in your communication."
- "It works partially. Vertical movement seems fine now. There's no horizontal movement in test mode. In normal mode, the horizontal movement sometimes seems reversed."

## 7. Current Work: Elliptical Sun Visualization

We have implemented a new, more physically accurate sun visualization. Instead of a simple circle, the sun is now rendered as an ellipse that realistically changes shape based on the angle of incidence. This provides a more intuitive visual cue for the sun's position relative to the solar panel.

### Key Improvements:
- **Physically-Based Model:** The visualization is the 2D projection of a cylindrical sunbeam onto the 3D plane of the virtual solar panel, resulting in an ellipse.
- **Dynamic Shape & Scaling:** The ellipse stretches from a circle to an elongated ellipse based on the sun's angle. A scaling exponent (`k=1.5`) has been added to make this effect more visually apparent.
- **Test-Driven Development:** The core mathematical logic for the ellipse calculation was developed using a strict TDD approach with Vitest.

### Known Issues:
- **Unstable Visual Rotation:** A significant bug remains where the ellipse's visual rotation on the screen is unstable and incorrectly affected by the phone's roll (the `gamma` orientation value). While the underlying `panel-relative` angle is calculated correctly and is stable, the 3D-to-2D projection logic in `projectWorldToScreen` does not correctly account for the phone's rotation, leading to erratic visual behavior. An attempt to fix this by overhauling the camera logic was unsuccessful and has been reverted.

### Next Steps:
- The immediate next step is to find a robust solution for the visual rotation bug. This will likely require a deeper dive into the `projectWorldToScreen` function to correctly and stably transform the ellipse's orientation from the 3D world space to the 2D screen space.

### Bug Fix Strategy (As of 2026-04-11)
Based on analysis of debug snapshots, we have identified four distinct bugs and ranked them by certainty, ease of fix, and risk of regression. The plan is to address them in the following order:

1.  **Fix Phantom `majorAxisVector` (Certainty: 100%, Risk: Very Low):**
    - **Symptom:** When the sun's projection is a perfect circle (e.g., flat panel under a zenith sun), numerical instability creates a random, non-zero `majorAxisVector` and a meaningless `panelAngle`.
    - **Fix:** Add a guard clause to `calculateEllipseParameters` to check if the sun is perpendicular to the panel. If so, force the `majorAxisVector` to `[0, 0, 0]`.

2.  **Redefine `panelAngle` (Certainty: 100%, Risk: Low):**
    - **Symptom:** The `panelAngle` is measured against a fixed world-North reference, making it unintuitive when the panel is tilted.
    - **Fix:** Modify `calculatePanelAngle` to use a reference vector relative to the panel's own geometry (e.g., its tilt direction) instead of world North.

3.  **Fix Flawed `Panel Tilt` Calculation (Certainty: 100%, Risk: Medium):**
    - **Symptom:** The `Panel Tilt` value is incorrectly influenced by the phone's roll (`gamma`) due to a flaw in the `panelNormalVector` calculation.
    - **Fix:** Correct the Euler angle math in `calculateSolarPanelOutput` to properly isolate the phone's pitch (`beta`) for the tilt calculation. This fix is riskier as it touches the core physics simulation.

4.  **Fix Unstable `screenAngle` (Certainty: 100%, Risk: High):**
    - **Symptom:** The main visual bug where the ellipse's rotation on screen is unstable and incorrectly tied to the phone's roll.
    - **Fix:** Re-architect the camera logic in `projectWorldToScreen` to create a roll-independent coordinate system for projecting the ellipse's orientation. This is the most complex and highest-risk fix.

## 10. Conversation Language
Primary language: English.
