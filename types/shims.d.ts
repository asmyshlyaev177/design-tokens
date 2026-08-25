/** Neither ships types; only apca.test.ts uses them. */
declare module "apca-w3" {
  export function APCAcontrast(txtY: number, bgY: number): number | string;
  export function sRGBtoY(rgb: number[]): number;
}
declare module "colorparsley" {
  export function colorParsley(color: string): number[];
}
