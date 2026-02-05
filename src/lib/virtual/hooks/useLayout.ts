import { useState } from "react";
import type { VflLayout } from "../types/types";
import { encodeVflToUrlParam } from "../utils/vfl";
import { getVflFromScreenDetails, getLayoutFromUrl, computeLayoutFromScreens } from "../utils/screenUtils";

export function useLayout() {
  const [layout, setLayout] = useState<VflLayout | null>(() => {
    if (typeof window === 'undefined') return null;
    return getLayoutFromUrl() || null;
  });
  
  const [permissionPending, setPermissionPending] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false; 
    // If we found a layout in the URL, we don't need permission/setup
    return getLayoutFromUrl() === null;
  });

  const requestPermission = async () => {
    console.log('requestPermission called');
    const vfl = await getVflFromScreenDetails();
    if (vfl) {
      const param = encodeVflToUrlParam(vfl);
      const newUrl = `${window.location.origin}${window.location.pathname}?layout=${param}`;
      console.log('[VirtualViewportProvider] permission granted, layout computed, reloading with', newUrl);
      window.location.href = newUrl; // Reloads the page
    } else {
      console.warn('[VirtualViewportProvider] permission denied or failed');
      alert('Permission denied or not supported. Please use "Continue Without Permission" instead.');
    }
  };

  const computeWithoutPermission = () => {
    console.log('computeWithoutPermission called');
    const computedLayout = computeLayoutFromScreens();
    const param = encodeVflToUrlParam(computedLayout);
    const newUrl = `${window.location.origin}${window.location.pathname}?layout=${param}`;
    console.log('[VirtualViewportProvider] computed layout without permission, reloading with', newUrl);
    window.location.href = newUrl; // Reloads the page
  };

  // We don't need the useEffect for initialization anymore since we do it lazily in useState.
  // However, if the URL changes without a reload (unlikely here but possible in SPA), we might miss it.
  // Given the reloading behavior in requestPermission/computeWithoutPermission, the component remounts anyway.


  return { layout, permissionPending, requestPermission, computeWithoutPermission };
}