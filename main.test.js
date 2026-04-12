import { describe, it, expect } from 'vitest';
import { calculateEllipseParameters, calculateScreenAngle, calculatePanelAngle } from './main.js';

describe('calculateEllipseParameters', () => {
    const sunRadius = 10;
    const scalingExponent = 1.5;

    it('should return a circle and a null vector when sun is directly overhead', () => {
        const sunDirection = [0, 0, 1];
        const panelNormal = [0, 0, 1];
        const result = calculateEllipseParameters(sunDirection, panelNormal, sunRadius, scalingExponent);
        expect(result.rx).toBeCloseTo(sunRadius);
        expect(result.ry).toBeCloseTo(sunRadius);
        expect(result.majorAxisVector[0]).toBeCloseTo(0);
        expect(result.majorAxisVector[1]).toBeCloseTo(0);
        expect(result.majorAxisVector[2]).toBeCloseTo(0);
    });

    it('should return an ellipse and a major axis vector when sun is at 45 degrees', () => {
        const sunDirection = [0, Math.sqrt(2)/2, Math.sqrt(2)/2];
        const panelNormal = [0, 0, 1];
        const cosAngle = Math.sqrt(2)/2;
        const result = calculateEllipseParameters(sunDirection, panelNormal, sunRadius, scalingExponent);
        expect(result.ry).toBeCloseTo(sunRadius);
        expect(result.rx).toBeCloseTo(sunRadius / (cosAngle ** scalingExponent));
        expect(result.majorAxisVector[0]).toBeCloseTo(0);
        expect(result.majorAxisVector[1]).toBeCloseTo(1);
        expect(result.majorAxisVector[2]).toBeCloseTo(0);
    });
});

describe('calculateScreenAngle', () => {
    it('should return 90 degrees for a vector pointing along the screen Y axis', () => {
        const majorAxisVector = [0, 1, 0]; // World-space vector pointing North
        const cameraRight = [1, 0, 0];     // Screen right is East
        const cameraUp = [0, 1, 0];         // Screen up is World North
        const angle = calculateScreenAngle(majorAxisVector, cameraRight, cameraUp);
        // The vector is aligned with cameraUp, which is the Y-axis of the screen projection.
        // atan2(1, 0) is PI/2, which is 90 degrees.
        expect(angle).toBeCloseTo(90);
    });

    it('should return 0 degrees when the phone is rolled 90 degrees', () => {
        const majorAxisVector = [0, 1, 0]; // World-space vector pointing North
        const cameraRight = [0, 0, -1];    // Phone rolled, screen right is now World Down
        const cameraUp = [0, 1, 0];         // Screen up is now World North
        const angle = calculateScreenAngle(majorAxisVector, cameraRight, cameraUp);
        // The vector is now aligned with cameraUp, which is still the Y-axis of the screen projection.
        // The angle should still be based on the screen's axes.
        // In this new orientation, the majorAxisVector projects entirely onto the cameraUp vector.
        // The projection onto cameraRight is 0. The projection onto cameraUp is 1.
        // atan2(1, 0) is PI/2, which is 90 degrees.
        expect(angle).toBeCloseTo(90);
    });
});

describe('calculatePanelAngle', () => {
    it('should return a stable angle regardless of phone roll', () => {
        const majorAxisVector = [1, 0, 0]; // East
        const panelNormal = [0, 0, 1];     // Pointing Up

        const angle = calculatePanelAngle(majorAxisVector, panelNormal);

        expect(angle).toBeCloseTo(90); // Angle of East relative to North is 90 degrees
    });

    describe('at Zenith Sun', () => {
        it('should return 0 when panel is flat', () => {
            // A zenith sun on a flat panel results in a zero vector for the major axis
            const majorAxisVector = [0, 0, 0];
            const panelNormal = [0, 0, 1];
            const angle = calculatePanelAngle(majorAxisVector, panelNormal);
            // A zero vector has no direction, so the angle is 0.
            expect(angle).toBe(0);
        });

        it('should return 0 when panel is tilted towards North', () => {
            // When the sun is at zenith, the major axis of the ellipse aligns with the panel's tilt direction.
            // If the panel is tilted 45 degrees towards North, the major axis will also point North.
            const majorAxisVector = [0, 1, 0]; // Major axis points North
            const panelNormal = [0, -Math.sqrt(2)/2, Math.sqrt(2)/2]; // Panel tilted 45 deg towards North
            const angle = calculatePanelAngle(majorAxisVector, panelNormal);
            // The angle should be 0 because the major axis is aligned with the panel's primary reference axis (North).
            expect(angle).toBeCloseTo(0);
        });

        it('should return 90 when panel is tilted towards North and sun is from the East', () => {
            // If the panel is tilted towards North and the sun is from the East, the major axis will point East.
            const majorAxisVector = [1, 0, 0]; // Major axis points East
            const panelNormal = [0, -Math.sqrt(2)/2, Math.sqrt(2)/2]; // Panel tilted 45 deg towards North
            const angle = calculatePanelAngle(majorAxisVector, panelNormal);
            // The angle should be 90 because the major axis is perpendicular to the panel's primary reference axis (North).
            expect(angle).toBeCloseTo(90);
        });
    });
});
