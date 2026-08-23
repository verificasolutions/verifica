export function HeroVideoPanel() {
  return (
    <div className="relative lg:pt-1">
      <div className="absolute -inset-8 rounded-[44px] bg-[radial-gradient(circle,rgba(0,245,212,0.16),transparent_62%)] blur-2xl" />
      <div className="relative overflow-hidden rounded-[32px] border border-white/8 bg-black shadow-[0_30px_100px_rgba(0,0,0,0.42)]">
        <video className="aspect-[16/9] h-full w-full object-cover" src="/verifica/videos/para-a-landing.mp4" autoPlay muted loop playsInline />
      </div>
    </div>
  );
}
