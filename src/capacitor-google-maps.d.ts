// Type declarations for Capacitor Google Maps custom element
import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'capacitor-google-map': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          ref?: React.RefObject<HTMLElement | null>;
        },
        HTMLElement
      >;
    }
  }
}
