import m from "mithril";
import * as SunCalc from "suncalc";

// Helper to convert degrees to radians
function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

// Helper function to convert radians to degrees
const toDegrees = (radians) => radians * 180 / Math.PI;

// Helper function to get cardinal direction from azimuth (0=N, 90=E, 180=S, 270=W)
const getCardinalDirection = (azimuth) => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(azimuth / 45) % 8;
    return directions[index];
};

// Function to calculate solar panel output based on sun position and device orientation
function calculateSolarPanelOutput(sunAltitude_deg, sunAzimuth_deg_north, alpha_deg, beta_deg, gamma_deg, isPanelOnBack) {
    // Ensure all necessary data is available
    if (sunAltitude_deg === null || sunAzimuth_deg_north === null || alpha_deg === null || beta_deg === null || gamma_deg === null) {
        return null; // Not enough data to calculate
    }

    // Convert all relevant angles to radians
    const sunAltitude_rad = toRadians(sunAltitude_deg);
    const sunAzimuth_rad = toRadians(sunAzimuth_deg_north);
    const alpha_rad = toRadians(alpha_deg);
    const beta_rad = toRadians(beta_deg);
    const gamma_rad = toRadians(gamma_deg);

    // 1. Sun Vector (unit vector in world coordinates: X=East, Y=North, Z=Up)
    const sunVector_x = Math.cos(sunAltitude_rad) * Math.sin(sunAzimuth_rad);
    const sunVector_y = Math.cos(sunAltitude_rad) * Math.cos(sunAzimuth_rad);
    const sunVector_z = Math.sin(sunAltitude_rad);
    const sunVector = [sunVector_x, sunVector_y, sunVector_z];

    // 2. Panel Normal Vector (using full 3D rotation)
    const ca = Math.cos(alpha_rad);
    const sa = Math.sin(alpha_rad);
    const cb = Math.cos(beta_rad);
    const sb = Math.sin(beta_rad);
    const cg = Math.cos(gamma_rad);
    const sg = Math.sin(gamma_rad);

    const panelNormal_x = sa * sb * cg + ca * sg;
    const panelNormal_y = -ca * sb * cg + sa * sg;
    const panelNormal_z = cb * cg;
    const panelNormalVector = [panelNormal_x, panelNormal_y, panelNormal_z];

    // 3. Calculate the dot product
    let dotProduct = 0;
    for (let i = 0; i < 3; i++) {
        dotProduct += sunVector[i] * panelNormalVector[i];
    }

    if (isPanelOnBack) {
        dotProduct = -dotProduct;
    }

    const solarPanelOutput = Math.max(0, dotProduct);

    // 4. Calculate the panel's true azimuth and tilt for UI display
    const displayNormal = isPanelOnBack ? panelNormalVector.map(v => -v) : panelNormalVector;

    // Tilt is the angle from the Z-axis (0=up, 90=horizontal, 180=down)
    const panelTilt_rad = Math.acos(displayNormal[2]);
    const panelTilt_deg = toDegrees(panelTilt_rad);

    let panelAzimuth_deg;
    const tolerance = 1; // degrees
    if (panelTilt_deg < tolerance || panelTilt_deg > (180 - tolerance)) {
        // At or near zenith/nadir, azimuth is unstable. Default to North.
        panelAzimuth_deg = 0;
    } else {
        // Azimuth is the angle in the horizontal plane, calculated from X and Y components.
        const panelAzimuth_rad = Math.atan2(displayNormal[0], displayNormal[1]); // atan2(x, y)
        panelAzimuth_deg = toDegrees(panelAzimuth_rad);
        if (panelAzimuth_deg < 0) {
            panelAzimuth_deg += 360; // Ensure azimuth is in 0-360 range
        }
    }

    return {
        output: solarPanelOutput.toFixed(2),
        dotProduct: dotProduct.toFixed(2),
        panelTilt: panelTilt_deg.toFixed(2),
        panelAzimuth: panelAzimuth_deg.toFixed(2),
        panelNormal: panelNormalVector
    };
}

// Main application logic
// Adding a comment to trigger a new GitHub Pages deploy

const App = {
    oninit: function(vnode) {
        vnode.state.latitude = null;
        vnode.state.longitude = null;
        vnode.state.currentSolarTime = null; // New state for current solar time
        vnode.state.geolocationError = null;
        vnode.state.alpha = null; // Z-axis rotation (0-360, compass direction)
        vnode.state.beta = null;  // X-axis rotation (-180-180, front-back tilt)
        vnode.state.gamma = null; // Y-axis rotation (-90-90, left-right tilt)
        vnode.state.orientationError = null;
        vnode.state.orientationPermissionGranted = false;
        vnode.state.sunAltitude = null;
        vnode.state.sunAzimuth = null;
        vnode.state.solarPanelOutput = null; // New state for solar panel output
        vnode.state.sunUpdateInterval = null; // To store the interval ID

        // Sonification state and setup
        vnode.state.audioContext = null;
        vnode.state.oscillator = null;
        vnode.state.gainNode = null;
        vnode.state.isSonificationPlaying = false;
        vnode.state.currentGain = 0; // New state to display current gain
        vnode.state.currentPitch = 0; // New state to display current pitch
        vnode.state.isPanelOnBack = true; // New state for panel direction
        vnode.state.testMode = false; // New state for test mode
        vnode.state.dotProduct = null; // New state for dot product
        vnode.state.sunAzimuth12pm = null; // New state for 12 PM sun azimuth
        vnode.state.sunAltitude12pm = null; // New state for 12 PM sun altitude
        vnode.state.solarNoonTime = null; // New state for solar noon time
        vnode.state.solarNoonAltitude = null; // New state for solar noon altitude
        vnode.state.solarNoonAzimuth = null; // New state for solar noon azimuth
        vnode.state.panelTilt = null;
        vnode.state.panelAzimuth = null;
        vnode.state.deviceHeading = null;
        vnode.state.panelNormalVector = null;
        vnode.state.lastEdited = "4/7/2026, 5:33:04 PM"; // Hardcoded timestamp
        vnode.state.alphaOffset = 0; // For manual calibration

        const handleOrientation = (event) => {
            vnode.state.alpha = event.alpha ? event.alpha.toFixed(2) : null;
            vnode.state.beta = event.beta ? event.beta.toFixed(2) : null;
            vnode.state.gamma = event.gamma ? event.gamma.toFixed(2) : null;
        };
        vnode.state.handleOrientation = handleOrientation;

        const calibrateOrientation = () => {
            // Set the current alpha as the new "zero" (North)
            vnode.state.alphaOffset = vnode.state.alpha;
            updateCalculations(); // Force immediate recalculation
            m.redraw();
        };
        vnode.state.calibrateOrientation = calibrateOrientation;

        // Function to start/stop sonification
        const toggleSonification = () => {
            if (vnode.state.isSonificationPlaying) {
                // Stop sonification
                if (vnode.state.oscillator) {
                    vnode.state.oscillator.stop();
                    vnode.state.oscillator.disconnect();
                    vnode.state.oscillator = null;
                }
                if (vnode.state.audioContext) {
                    vnode.state.audioContext.close();
                    vnode.state.audioContext = null;
                }
                vnode.state.isSonificationPlaying = false;
            } else {
                // Start sonification
                vnode.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                vnode.state.oscillator = vnode.state.audioContext.createOscillator();
                vnode.state.gainNode = vnode.state.audioContext.createGain();

                vnode.state.oscillator.type = 'sine'; // or 'square', 'sawtooth', 'triangle'
                vnode.state.oscillator.frequency.setValueAtTime(440, vnode.state.audioContext.currentTime); // Initial A4 note
                vnode.state.gainNode.gain.setValueAtTime(0.5, vnode.state.audioContext.currentTime); // Set initial gain to make it audible

                vnode.state.oscillator.connect(vnode.state.gainNode);
                vnode.state.gainNode.connect(vnode.state.audioContext.destination);

                vnode.state.oscillator.start();
                vnode.state.isSonificationPlaying = true;
            }

        };

        // Expose to component for UI interaction
        vnode.state.toggleSonification = toggleSonification;

        const togglePanelDirection = () => {
            vnode.state.isPanelOnBack = !vnode.state.isPanelOnBack;
            updateCalculations(); // Recalculate output with new panel direction
            m.redraw();
        };
        vnode.state.togglePanelDirection = togglePanelDirection;

        const toggleTestMode = () => {
            vnode.state.testMode = !vnode.state.testMode;
            updateCalculations();
            m.redraw();
        };
        vnode.state.toggleTestMode = toggleTestMode;

        // Function to update sun position and solar panel output
        const updateCalculations = () => {
            if (vnode.state.latitude !== null && vnode.state.longitude !== null) {
                // Update Sun Position
                const now = new Date();
                let sunPosVar;
                let timesVar;

                if (vnode.state.testMode) {
                    vnode.state.sunAltitude = 90.00; // Zenith
                    vnode.state.sunAzimuth = 180.00; // South (for Solar Noon)
                    vnode.state.currentSolarTime = "12:00 PM"; // Fixed solar noon for zenith sun at South
                } else {
                    sunPosVar = SunCalc.getPosition(now, vnode.state.latitude, vnode.state.longitude);
                    vnode.state.sunAltitude = (sunPosVar.altitude * 180 / Math.PI).toFixed(2); // Convert to degrees
                    // SunCalc's azimuth is from South, clockwise. Convert to North=0, East=90, South=180, West=270
                    let azimuth_deg = sunPosVar.azimuth * 180 / Math.PI; // Convert to degrees
                    azimuth_deg = (azimuth_deg + 180) % 360; // Adjust to North=0 and wrap around
                    vnode.state.sunAzimuth = azimuth_deg.toFixed(2);

                    // Calculate current solar time more accurately using solarNoon
                    timesVar = SunCalc.getTimes(now, vnode.state.latitude, vnode.state.longitude);
                    if (timesVar.solarNoon) {
                        const diff_ms = now.getTime() - timesVar.solarNoon.getTime();
                        let solarHours = 12 + (diff_ms / (1000 * 60 * 60)); // Add to 12.0 for solar noon

                        let hours = Math.floor(solarHours);
                        let minutes = Math.floor((solarHours - hours) * 60);
                        let seconds = Math.floor(((solarHours - hours) * 60 - minutes) * 60);

                        hours = (hours % 24 + 24) % 24; // Ensure hours are within 0-23 and handle negative

                        let displayHours = hours % 12;
                        displayHours = displayHours ? displayHours : 12; // The hour '0' should be '12'
                        const ampm = hours >= 12 ? 'PM' : 'AM';

                        vnode.state.currentSolarTime = 
                            String(displayHours).padStart(2, '0') + ":" +
                            String(minutes).padStart(2, '0') + ":" +
                            String(seconds).padStart(2, '0') + " " + ampm;
                    } else {
                        vnode.state.currentSolarTime = "Calculating..."; // Fallback if solarNoon is not available
                    }
                }

                // For Reference Sun Positions, always use actual suncalc values regardless of test mode
                // Ensure 'timesVar' is calculated if not already (e.g., in test mode)
                if (!timesVar) {
                    timesVar = SunCalc.getTimes(now, vnode.state.latitude, vnode.state.longitude);
                }

                // Update Solar Panel Output
                if (vnode.state.alpha !== null && vnode.state.beta !== null && vnode.state.gamma !== null) {
                    // Apply manual calibration offset for compass heading
                    const calibratedAlpha = (parseFloat(vnode.state.alpha) - vnode.state.alphaOffset + 360) % 360;

                    const panelOutput = calculateSolarPanelOutput(
                        parseFloat(vnode.state.sunAltitude),
                        parseFloat(vnode.state.sunAzimuth),
                        calibratedAlpha, // Use calibrated alpha for the physics model
                        parseFloat(vnode.state.beta),  // Use raw beta
                        parseFloat(vnode.state.gamma), // Use raw gamma
                        vnode.state.isPanelOnBack
                    );
                    if (panelOutput) {
                        vnode.state.solarPanelOutput = panelOutput.output;
                        vnode.state.dotProduct = panelOutput.dotProduct;
                        vnode.state.panelAzimuth = panelOutput.panelAzimuth;
                        vnode.state.panelTilt = panelOutput.panelTilt;
                        vnode.state.panelNormalVector = panelOutput.panelNormal;
                    }

                    // Calculate Device Heading (Compass)
                    vnode.state.deviceHeading = calibratedAlpha.toFixed(2);

                    // Update sonification pitch
                    if (vnode.state.isSonificationPlaying && vnode.state.oscillator) {
                        const minFrequency = 200; // Hz
                        const maxFrequency = 800; // Hz
                        const pitchValue = minFrequency + (maxFrequency - minFrequency) * parseFloat(vnode.state.solarPanelOutput);
                        vnode.state.oscillator.frequency.setValueAtTime(pitchValue, vnode.state.audioContext.currentTime);
                        vnode.state.currentPitch = pitchValue.toFixed(0); // Store for display
                    }
                }

                // Calculate sun position for 12 PM today
                const noonDate = new Date();
                noonDate.setHours(12, 0, 0, 0);
                const sunPos12pm = SunCalc.getPosition(noonDate, vnode.state.latitude, vnode.state.longitude);

                // Convert suncalc azimuth (South-0, West-90) to standard compass azimuth (North-0, East=90)
                const suncalcAzimuthDegrees12pm = toDegrees(sunPos12pm.azimuth);
                let standardCompassAzimuth12pm = (suncalcAzimuthDegrees12pm + 180) % 360;
                if (standardCompassAzimuth12pm < 0) standardCompassAzimuth12pm += 360; // Ensure positive angle

                vnode.state.sunAzimuth12pm = standardCompassAzimuth12pm.toFixed(2);
                vnode.state.sunAltitude12pm = toDegrees(sunPos12pm.altitude).toFixed(2);

                // Calculate Solar Noon time and sun position at Solar Noon
                timesVar = SunCalc.getTimes(new Date(), vnode.state.latitude, vnode.state.longitude);
                const solarNoonDate = timesVar.solarNoon;
                const sunPosSolarNoon = SunCalc.getPosition(solarNoonDate, vnode.state.latitude, vnode.state.longitude);

                // Convert solar noon azimuth (South-0, West-90) to standard compass azimuth (North-0, East=90)
                const suncalcAzimuthDegreesSolarNoon = toDegrees(sunPosSolarNoon.azimuth);
                let standardCompassAzimuthSolarNoon = (suncalcAzimuthDegreesSolarNoon + 180) % 360;
                if (standardCompassAzimuthSolarNoon < 0) standardCompassAzimuthSolarNoon += 360; // Ensure positive angle

                vnode.state.solarNoonTime = solarNoonDate.toLocaleTimeString();
                vnode.state.solarNoonAltitude = toDegrees(sunPosSolarNoon.altitude).toFixed(2);
                vnode.state.solarNoonAzimuth = standardCompassAzimuthSolarNoon.toFixed(2);

            }
            m.redraw();
            };

        // Geolocation setup
        if ("geolocation" in navigator) {
            navigator.geolocation.watchPosition(
                function(position) {
                    vnode.state.latitude = position.coords.latitude;
                    vnode.state.longitude = position.coords.longitude;
                    updateCalculations(); // Update all calculations immediately on geolocation update
                    // If an interval is already running, clear it before setting a new one
                    if (vnode.state.sunUpdateInterval) {
                        clearInterval(vnode.state.sunUpdateInterval);
                    }
                    // Start updating calculations every second
                    vnode.state.sunUpdateInterval = setInterval(() => { updateCalculations(); m.redraw(); }, 1000);
                    m.redraw();
                },
                function(error) {
                    vnode.state.geolocationError = error.message;
                    m.redraw();
                }
            );
        } else {
            vnode.state.geolocationError = "Geolocation is not supported by this browser.";
        }

        // Device Orientation setup
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            vnode.state.orientationPermissionGranted = false;
        } else if (window.DeviceOrientationEvent) {
            vnode.state.orientationPermissionGranted = true;
            window.addEventListener('deviceorientation', function(event) {
                vnode.state.alpha = event.alpha ? event.alpha.toFixed(2) : null;
                vnode.state.beta = event.beta ? event.beta.toFixed(2) : null;
                vnode.state.gamma = event.gamma ? event.gamma.toFixed(2) : null;
                updateCalculations(); // Update calculations on orientation change
                m.redraw();
            }, true);
        } else {
            vnode.state.orientationError = "Device Orientation is not supported by this browser.";
        }
    },

    onremove: function(vnode) {
        // Clear the interval when the component is removed to prevent memory leaks
        if (vnode.state.sunUpdateInterval) {
            clearInterval(vnode.state.sunUpdateInterval);
        }
        // Stop and close audio context if it exists
        if (vnode.state.audioContext) {
            vnode.state.audioContext.close();
            vnode.state.audioContext = null;
        }
        // Remove device orientation event listeners
        window.removeEventListener('deviceorientation', vnode.state.handleOrientation, true);
    },

    requestOrientationPermission: function(vnode) {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        vnode.state.orientationPermissionGranted = true;
                        window.addEventListener('deviceorientation', function(event) {
                            vnode.state.alpha = event.alpha ? event.alpha.toFixed(2) : null;
                            vnode.state.beta = event.beta ? event.beta.toFixed(2) : null;
                            vnode.state.gamma = event.gamma ? event.gamma.toFixed(2) : null;
                            updateCalculations(); // Update calculations on orientation change
                            m.redraw();
                        }, true);
                    } else {
                        vnode.state.orientationError = "Permission to access device orientation was denied.";
                    }
                    m.redraw();
                })
                .catch(error => {
                    vnode.state.orientationError = "Error requesting device orientation permission: " + error.message;
                    m.redraw();
                });
        }
    },

    view: function(vnode) {
        return m("div", [
            m("h1", "Solar Sonification"),
            vnode.state.geolocationError ?
                m("p", "Geolocation Error: " + vnode.state.geolocationError) :
                m("div", [
                    m("p", "Latitude: " + (vnode.state.latitude || "Waiting...")),
                    m("p", "Longitude: " + (vnode.state.longitude || "Waiting...")),
                    m("p", "Current Solar Time: " + (vnode.state.currentSolarTime || "Waiting...")),
                    m("p", "Sun Altitude: " + (vnode.state.sunAltitude || "Waiting...") + "°"),
                    m("p", "Sun Azimuth: " + (vnode.state.sunAzimuth !== null ? vnode.state.sunAzimuth + "° " + getCardinalDirection(parseFloat(vnode.state.sunAzimuth)) : "Waiting...")),
                    m("p", "Solar Panel Output: " + (vnode.state.solarPanelOutput !== null ? (vnode.state.solarPanelOutput * 100).toFixed(0) + "%" : "Waiting...")),
                    vnode.state.isSonificationPlaying ? m("p", "Current Pitch: " + vnode.state.currentPitch + " Hz") : null,
                    !vnode.state.orientationPermissionGranted ?
                        m("button", { onclick: () => App.requestOrientationPermission(vnode) }, "Allow Device Orientation") :
                        null,
                    m("button", {
                        onclick: vnode.state.toggleSonification
                    }, vnode.state.isSonificationPlaying ? "Stop Sonification" : "Start Sonification"),
                    m("button", { onclick: vnode.state.togglePanelDirection }, "Panel on " + (vnode.state.isPanelOnBack ? "Back" : "Front") + " of Phone"),
                        m("button", { onclick: vnode.state.toggleTestMode }, vnode.state.testMode ? "Exit Test Mode" : "Enter Test Mode (Zenith Sun)")
                ]),
            m("hr"), // Separator

            m("div", [
                m("div", {
                    style: "margin-top: 10px;"
                }, [
                    m("button", { onclick: vnode.state.calibrateOrientation }, "Calibrate Compass (Set Current Heading as North)"),
                    (vnode.state.alphaOffset !== 0) ? 
                        m("p", { style: "font-style: italic; color: #888;" }, "Calibration offset is active.") :
                        m("p", { style: "font-style: italic; color: #888;" }, "Calibration offset is inactive.")
                ]),

                m("h3", "Raw Sensor Data"),
                m("p", "Alpha (Z-axis): " + (vnode.state.alpha || "Waiting...")),
                m("p", "Beta (X-axis): " + (vnode.state.beta || "Waiting...")),
                m("p", "Gamma (Y-axis): " + (vnode.state.gamma || "Waiting...")),

                m("h3", "Calibration Info"),
                m("p", "Alpha Offset: " + vnode.state.alphaOffset),

                m("h3", "Debug Info"),
                m("p", "Dot Product (Sun vs Panel): " + (vnode.state.dotProduct !== null ? vnode.state.dotProduct : "Waiting...")),
                m("p", "Device Heading (Compass): " + (vnode.state.deviceHeading !== null ? vnode.state.deviceHeading + "° (" + getCardinalDirection(vnode.state.deviceHeading) + ")" : "Waiting...")),
                m("p", "Panel Azimuth: " + (vnode.state.panelAzimuth !== null ? vnode.state.panelAzimuth + "° (" + getCardinalDirection(vnode.state.panelAzimuth) + ")" : "Waiting...")),
                m("p", "Panel Tilt: " + (vnode.state.panelTilt !== null ? vnode.state.panelTilt + "°" : "Waiting...")),
                m("p", "Panel Normal Vector: " + (vnode.state.panelNormalVector ? `[${vnode.state.panelNormalVector.map(n => n.toFixed(2)).join(', ')}]` : "Waiting...")),
            ]),

            m("hr"), // Separator

            m("div", [
                m("h2", "Reference Sun Positions"),
                m("h3", "At 12 PM Clock Time Today"),
                m("p", "Azimuth: " + (vnode.state.sunAzimuth12pm !== null ? vnode.state.sunAzimuth12pm + "° " + getCardinalDirection(parseFloat(vnode.state.sunAzimuth12pm)) : "Waiting...")),
                m("p", "Altitude: " + (vnode.state.sunAltitude12pm !== null ? vnode.state.sunAltitude12pm + "°" : "Waiting...")),
                m("h3", "At Solar Noon Today"),
                m("p", "Time: " + (vnode.state.solarNoonTime !== null ? vnode.state.solarNoonTime : "Waiting...")),
                m("p", "Azimuth: " + (vnode.state.solarNoonAzimuth !== null ? vnode.state.solarNoonAzimuth + "° " + getCardinalDirection(parseFloat(vnode.state.solarNoonAzimuth)) : "Waiting...")),
                m("p", "Altitude: " + (vnode.state.solarNoonAltitude !== null ? vnode.state.solarNoonAltitude + "°" : "Waiting...")),
            ]),

            m("hr"), // Separator
            vnode.state.orientationError ?
                m("p", "Orientation Error: " + vnode.state.orientationError) :
            m("footer", {
                style: "margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 0.8em; color: #888;"
            }, "Last Edited: " + vnode.state.lastEdited)
        ]);
    },

    requestOrientationPermission: async function(vnode) {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceOrientationEvent.requestPermission();
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', vnode.state.handleOrientation, true);
                    vnode.state.orientationPermissionGranted = true;
                } else {
                    vnode.state.orientationError = "Permission to access device orientation was denied.";
                }
            } catch (error) {
                vnode.state.orientationError = "Error requesting device orientation permission: " + error.message;
            }
        } else {
            // For non-iOS 13+ browsers that don't need explicit permission
            window.addEventListener('deviceorientation', vnode.state.handleOrientation, true);
            vnode.state.orientationPermissionGranted = true; // Assume granted
        }
        m.redraw();
    }
};

m.mount(document.body, App);
