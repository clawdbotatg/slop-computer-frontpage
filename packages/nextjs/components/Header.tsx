"use client";

import React from "react";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

export const Header = () => {
  return (
    <header className="w-full px-4 py-3 flex justify-end items-center">
      <RainbowKitCustomConnectButton />
    </header>
  );
};

export default Header;
