import React from "react";
import type { VirtualContext } from "../types/types";

export const VirtualCtx = React.createContext<VirtualContext | null>(null);