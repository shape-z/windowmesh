'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useState, useContext, useMemo } from 'react';
import { VirtualCtx } from '@/lib/virtual/extensions/virtualContext';

interface ArrowProps {
  id: number;
  angle: number; // degrees
  distance: number; // radius in vmin
  duration: number; // seconds
  mirrorDelay: number; // seconds
  size: number; // scale factor
}

function AnimatedBackground() {
  const { virtualRect, getVirtualBounds } = useContext(VirtualCtx) || {};
  const [arrows, setArrows] = useState<ArrowProps[]>([]);

  // Calculate dynamic center and radius based on virtual context
  const { centerX, centerY, radiusBase } = useMemo(() => {
    const isClient = typeof window !== 'undefined';
    // Default fallback values
    let cX = '50%';
    let cY = '50%';
    let rBase = isClient ? Math.max(window.innerWidth, window.innerHeight) : 1000;

    if (virtualRect && getVirtualBounds) {
      const bounds = getVirtualBounds();
      if (bounds.w > 0 && bounds.h > 0) {
        const cx = bounds.x + bounds.w / 2;
        const cy = bounds.y + bounds.h / 2;
        
        cX = `${cx - virtualRect.x}px`;
        cY = `${cy - virtualRect.y}px`;
        rBase = Math.sqrt(bounds.w ** 2 + bounds.h ** 2) / 2;
      }
    }
    return { centerX: cX, centerY: cY, radiusBase: rBase };
  }, [virtualRect, getVirtualBounds]);

  useEffect(() => {
    const arrowCount = 60;
    const newArrows: ArrowProps[] = [];

    for (let i = 0; i < arrowCount; i++) {
      newArrows.push({
        id: i,
        angle: Math.random() * 360,
        distance: 0.6 + Math.random() * 0.8, // Factor of radiusBase
        duration: 2 + Math.random() * 4,
        mirrorDelay: -Math.random() * 5,
        size: 0.5 + Math.random() * 0.5,
      });
    }

    setArrows(newArrows);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
       {/* Gradient Background covering the area */}
       <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800" />
       <style>{`
         @keyframes flyIn {
           0% {
             transform: rotate(var(--angle)) translate(var(--dist)) scale(1);
             opacity: 0;
           }
           10% {
             opacity: var(--opacity);
           }
           90% {
             opacity: var(--opacity);
           }
           100% {
             transform: rotate(var(--angle)) translate(0) scale(0.2);
             opacity: 0;
           }
         }
       `}</style>

      {arrows.map((arrow) => (
        <div
          key={arrow.id}
          className="absolute left-1/2 top-1/2"
          style={{
            '--angle': `${arrow.angle}deg`,
            '--dist': `${arrow.distance}vmin`,
            '--opacity': `${0.3 + arrow.size * 0.4}`,
            width: '0px',
            height: '0px',
            animationName: 'flyIn',
            animationDuration: `${arrow.duration}s`,
            animationDelay: `${arrow.mirrorDelay}s`, 
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear', 
          } as React.CSSProperties}
        >
           <div 
             className="text-cyan-500 will-change-transform"
             style={{ 
                transform: `scale(${arrow.size}) rotate(180deg)`,
                filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.6))'
             }} 
           >
              <svg 
                width="48" 
                height="12" 
                viewBox="0 0 48 12" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M48 6L38 0V4H0V8H38V12L48 6Z" fill="currentColor" fillOpacity="0.8"/>
              </svg>
           </div>
        </div>
      ))}
      
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-gray-900/80" />
    </div>
  );
}

export default function Page() {
  const demos = useMemo(() => ['bubbles', 'game-of-life'], []);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('random-subpage') === 'true' && demos.length > 0) {
      const randomIndex = Math.floor(Math.random() * demos.length);
      const targetDemo = demos[randomIndex];
      const params = searchParams.toString();
      router.replace(`/demos/${targetDemo}${params ? `?${params}` : ''}`);
    }
  }, [demos, router, searchParams]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <AnimatedBackground />
      <div className="relative z-10 w-[500px] shadow-2xl border border-gray-700 bg-gray-900/95 text-white rounded-lg backdrop-blur-sm">
        <div className="text-center p-6">
          <h2 className="text-2xl font-bold text-white mb-2">WindowMesh Demos</h2>
          <p className="text-lg text-gray-300">
            Choose a demo to explore the multi-window synchronization capabilities.
          </p>
        </div>
        <div className="space-y-4 pt-4 px-6 pb-6">
          {demos.length > 0 ? (
            demos.map((demo) => {
              const params = searchParams.toString();
              return (
                <Link
                  key={demo}
                  href={`/demos/${demo}${params ? `?${params}` : ''}`}
                  className="flex items-center justify-center w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium capitalize transition-colors"
                >
                  {demo.replace(/-/g, ' ')}
                </Link>
              );
            })
          ) : (
             <div className="text-center text-gray-500 py-4">No demos found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
