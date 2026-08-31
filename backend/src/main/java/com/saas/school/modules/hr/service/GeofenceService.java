package com.saas.school.modules.hr.service;

/**
 * Great-circle distance helpers for the location-based attendance
 * flow. Standalone (no Spring bean) — pure math, easily unit-testable
 * without wiring up a context.
 *
 * <p>Uses the haversine formula against an Earth-radius of 6 371 km.
 * At the scale we care about (0–2 km around a campus point) the
 * error vs a proper ellipsoidal formula is well below 1 m, so the
 * cheaper haversine wins on both simplicity and speed.</p>
 */
public final class GeofenceService {

    private GeofenceService() {}

    /** Mean Earth radius, metres. */
    private static final double EARTH_RADIUS_M = 6_371_000d;

    /**
     * Straight-line distance in metres between two WGS84 lat/lng
     * points, using the haversine formula.
     *
     * @return distance in metres, always &ge; 0
     */
    public static double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                 + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                 * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_M * c;
    }
}
