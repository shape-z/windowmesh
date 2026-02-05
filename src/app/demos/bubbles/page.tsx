"use client";

import React, { useContext, useEffect, useState } from "react";
import { VirtualCtx } from "@/lib/virtual/extensions/virtualContext";
import type { VirtualEngine } from "@/lib/virtual/engine/VirtualEngine";

type Particle = {
  id: string;
  centerX: number;
  centerY: number;
  radius: number;
  angle: number;
  speed: number;
  hue: number;
  size: number;
  opacity?: number;
};

const PARTICLE_COUNT = 22;
const ANIMATION_SPEED = 0.02; // Reduced significantly to ensure "never too fast"
const LARGE_ORB_COUNT = 4; // 3-5 large background orbs

function ParticleAnimation() {
  const ctx = useContext(VirtualCtx);
  const { layout, isLeader, sharedData, engine } = ctx || {};
  const virtualEngine = engine as VirtualEngine;
  
  // Ref to store references to DOM elements
  const particleRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  // Ref to store current particles data to access in animation loop without dependency issues
  const particlesRef = React.useRef<Particle[]>([]);

  // 1. Background Color Management
  useEffect(() => {
    if (!ctx || !ctx.layout) return;
    let color = sharedData?.bgColor;
    // Leader initializes background color
    if (!color && isLeader && virtualEngine) {
       // A dark base color
       color = `hsl(${Math.random() * 360}, 30%, 15%)`;
       virtualEngine.setSharedData("bgColor", color);
    }
    // All apply color
    if (color && typeof window !== 'undefined') {
        document.body.style.backgroundColor = color as string;
    }
  }, [ctx, sharedData?.bgColor, isLeader, virtualEngine]);

  // 2. Particle Initialization (Leader Only)
  useEffect(() => {
    if (!ctx || !ctx.layout) return;
    if (isLeader && virtualEngine && (!sharedData?.particles || (sharedData?.particles as Particle[]).length === 0)) {
        const initParticles: Particle[] = [];
        const frameW = layout?.frame?.w || 1920; 
        const frameH = layout?.frame?.h || 1080;
        
        console.log("[ParticleAnimation] Initializing Particles as Leader");
        
        // 1. Large Background Orbs (3-5 items, >40% screen size)
        // Added first to be rendered in the background
        for (let i = 0; i < LARGE_ORB_COUNT; i++) {
           const minDim = Math.min(frameW, frameH);
           // Size: 80% to 150% of the smallest screen dimension (Very Large)
           const size = minDim * (0.8 + Math.random() * 0.7); 
           
           const centerX = Math.random() * frameW;
           const centerY = Math.random() * frameH;
           const orbitRadius = Math.random() * 200 + 50;
           
           const direction = Math.random() > 0.5 ? 1 : -1;
           // Speed calculation (same formula but size is huge so speed is tiny)
           const speedFactor = Math.random() * 0.5 + 0.5; 
           const speed = (20 / size) * speedFactor * ANIMATION_SPEED * direction;

           initParticles.push({
             id: `bg-orb-${i}`,
             centerX,
             centerY,
             radius: orbitRadius,
             angle: Math.random() * Math.PI * 2,
             speed,
             hue: Math.random() * 360,
             size,
             opacity: 1.0, // Fully opaque
           });
        }

        // 2. Standard Particles
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const centerX = Math.random() * frameW; 
          const centerY = Math.random() * frameH;
          const orbitRadius = Math.random() * 200 + 50;
          const size = Math.random() * 250 + 50; 
          const direction = Math.random() > 0.5 ? 1 : -1;
          const speedFactor = Math.random() * 0.5 + 0.5;
          const speed = (20 / size) * speedFactor * ANIMATION_SPEED * direction;

          initParticles.push({
            id: `p${i}`,
            centerX,
            centerY,
            radius: orbitRadius,
            angle: Math.random() * Math.PI * 2,
            speed: speed,
            hue: Math.random() * 360,
            size,
            opacity: 0.9, // Standard opacity
          });
        }
        virtualEngine.setSharedData("particles", initParticles);
    }
  }, [ctx, isLeader, sharedData?.particles, layout, virtualEngine]);

  // Sync particles from context to ref
  useEffect(() => {
    if (sharedData?.particles) {
      particlesRef.current = sharedData.particles as Particle[];
    }
  }, [sharedData?.particles]);

  // 3. Animation Loop (Direct DOM Manipulation)
  useEffect(() => {
    let req: number;
    
    // Use Date.now() for synchronization across windows on the same machine
    const animate = () => { 
      const t = Date.now() / 1000;
      
      const currentParticles = particlesRef.current;
      
      currentParticles.forEach((p) => {
        const el = particleRefs.current.get(p.id);
        if (el) {
           const currentAngle = p.angle + p.speed * t * 60; // 60fps normalization
           const x = p.centerX + Math.cos(currentAngle) * p.radius;
           const y = p.centerY + Math.sin(currentAngle) * p.radius;

           // Use translate3d for GPU acceleration
           // -50% -50% centering is included in the translate
           el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        }
      });
      
      req = requestAnimationFrame(animate); 
    };

    req = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(req);
  }, []); // Run once on mount, reads from ref

  // If context isn't ready
  if (!ctx || !ctx.layout) return null;

  // 4. Rendering (Initial Render Only)
  const particles = (sharedData?.particles as Particle[]) || [];
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => {
        const color1 = `hsl(${p.hue}, 60%, 40%)`;
        const color2 = `hsl(${p.hue}, 60%, 60%)`;

        return (
          <div
            key={p.id}
            ref={(el) => {
              if (el) particleRefs.current.set(p.id, el);
              else particleRefs.current.delete(p.id);
            }}
            className="absolute will-change-transform"
            style={{
              // Initial position (will be overwritten by JS immediately, but good for SSR/Layout)
              left: 0, 
              top: 0,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: `linear-gradient(to top right, ${color1}, ${color2})`,
              // Initial transform to off-screen or 0,0 - updated by loop
              transform: "translate3d(0,0,0)", 
              opacity: p.opacity ?? 0.9, 
            }}
          />
        );
      })}
    </div>
  );
}


export default function Page() {
  return (
    <main className="relative w-full h-full min-h-screen overflow-hidden">
        <ParticleAnimation />
    </main>
  );
}
