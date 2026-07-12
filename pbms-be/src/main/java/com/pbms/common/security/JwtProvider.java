package com.pbms.common.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtProvider {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration}")
    private long jwtExpirationMs;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    public String generateToken(String email, String role) {
        Date now = java.util.Date.from(com.pbms.common.utils.TimeProvider.now().atZone(java.time.ZoneId.systemDefault()).toInstant());
        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + jwtExpirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    public String generateTemporaryToken(String email, String role, long expirationMs) {
        Date now = java.util.Date.from(com.pbms.common.utils.TimeProvider.now().atZone(java.time.ZoneId.systemDefault()).toInstant());
        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    private io.jsonwebtoken.Clock getSimulatedClock() {
        return () -> java.util.Date.from(com.pbms.common.utils.TimeProvider.now().atZone(java.time.ZoneId.systemDefault()).toInstant());
    }

    public String getEmailFromToken(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .clock(getSimulatedClock())
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    public String getRoleFromToken(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .clock(getSimulatedClock())
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .get("role", String.class);
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(getSigningKey())
                    .clock(getSimulatedClock())
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public String generateCheckoutToken(String sessionId, double expectedFee) {
        Date now = java.util.Date.from(com.pbms.common.utils.TimeProvider.now().atZone(java.time.ZoneId.systemDefault()).toInstant());
        return Jwts.builder()
                .subject("checkout")
                .claim("sessionId", sessionId)
                .claim("expectedFee", expectedFee)
                .issuedAt(now)
                // 5 minutes expiration
                .expiration(new Date(now.getTime() + 5 * 60 * 1000))
                .signWith(getSigningKey())
                .compact();
    }

    public io.jsonwebtoken.Claims getCheckoutClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .clock(getSimulatedClock())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
