import { Component, type ReactNode } from "react";

export class EditorErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed:false};

  static getDerivedStateFromError() { return {failed:true}; }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="me-ed me-error" role="alert">
      <section><h2>Editor se nepodařilo zobrazit</h2>
        <p>Uložená mapa ani místní koncept nebyly smazány. Zkuste editor otevřít znovu.</p>
        <div><button className="me-btn primary" onClick={() => this.setState({failed:false})}>Zkusit znovu</button>
          <a className="me-btn" href="/boj/mapy">Zpět na mapy</a></div>
      </section>
    </main>;
  }
}
