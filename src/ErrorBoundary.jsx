import React from 'react';

// Catches a render error so it does not take the whole app down. `fallback(error, reset)`
// renders the replacement; `resetKey` (for example the page address) clears the error when it
// changes. Without a fallback (the outermost boundary, outside the theme and translations) it
// shows a plain bilingual message with a reload button, never a stack trace.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
    this.reset = () => this.setState({ error: null });
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error, info) {
    // For support: the details stay in the console.
    console.error(error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    const { fallback, children } = this.props;
    if (!error) {
      return children;
    }
    if (fallback) {
      return fallback(error, this.reset);
    }
    return (
      <div role="alert" style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <p dir="rtl">משהו השתבש. רעננו את הדף כדי להמשיך.</p>
        <p dir="ltr">Something went wrong. Reload the page to continue.</p>
        <button type="button" onClick={() => window.location.reload()}>
          רענון · Reload
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
