// Supplemental type declarations for IINA plugin APIs that exist at runtime
// (verified against IINA 1.4.3) but are missing from `iina-plugin-definition@0.0.7`.
//
// The `input` module is the main gap: `iina.input.getAllKeyBindings()` works at
// runtime but isn't in the shipped .d.ts. We declare just what we use, and the
// code still guards with `typeof input !== "undefined"` for older IINA builds.

declare namespace IINA {
  namespace API {
    /** A single registered key binding, as returned by `input.getAllKeyBindings()`. */
    interface KeyBinding {
      /** The key combo, e.g. "Meta+k" / "RIGHT". */
      key: string;
      /** The raw mpv or IINA command string this key runs, e.g. "cycle pause". */
      action: string;
      /** Whether `action` is an IINA-specific command rather than a plain mpv command. */
      isIINACommand: boolean;
      /** Optional human-readable comment from the input config, if any. */
      comment?: string;
      /** mpv's normalized form of `key`. */
      normalizedMpvKey?: string;
    }

    interface Input {
      /** All registered mpv + IINA key bindings, keyed by key code. */
      getAllKeyBindings(): Record<string, KeyBinding>;

      readonly MOUSE: number;
      readonly RIGHT_MOUSE: number;
      readonly OTHER_MOUSE: number;

      onKeyDown(button: string, callback: (data: any) => void): void;
      onKeyUp(button: string, callback: (data: any) => void): void;
    }
  }

  interface IINAGlobal {
    input: API.Input;
  }
}

/** Available in the main/global entry context at runtime. */
declare const input: IINA.API.Input;
