"use client";

import React from "react";
import { ListenOn } from "~~/components/ListenOn";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

export const Header = () => {
  return (
    <header className="w-full px-4 py-3 flex justify-end items-center">
      <ListenOn />
      <RainbowKitCustomConnectButton />
    </header>
  );
};

export default Header;
