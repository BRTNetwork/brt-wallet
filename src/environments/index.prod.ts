// This file contains production variables. (When you work in PROD MODE)
// This file is use by webpack. Please don't rename it and don't move it to another directory.
import { Level } from 'angular2-logger/core';
export const environment = {
  production: true,
  loglevel: Level.DEBUG,
  swap_endpoint_url: "https://swap.brt.network/swap",
  insight_endpoint_url: "http://insight.brt.info",
  explorer_endpoint_url: "http://explorer.brt.network"
};
