import { getFollowState } from "./queries";
import { SocialButton } from "@/features/social/social-button";
export async function ProfileFollow({ username }: { username: string }) {
  const state = await getFollowState(username);
  return <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
    <p className="text-sm"><strong>{state.followers}</strong> подписчиков</p>
    <p className="text-sm"><strong>{state.following}</strong> подписок</p>
    {!state.isSelf && <SocialButton kind="follow" target={username} active={state.active} viewer={state.viewer} returnTo={`/profile/${username}`} />}
  </div>;
}
