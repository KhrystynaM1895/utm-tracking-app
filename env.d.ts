/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

// App Bridge custom element. Register <ui-nav-menu> on the global JSX namespace
// (the namespace tsc resolves intrinsic elements against in this project).
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "ui-nav-menu": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

export {};
