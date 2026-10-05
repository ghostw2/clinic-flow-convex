import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import { internal } from "./_generated/api";

// The Password provider's default profile() only keeps `email`, silently
// dropping any other signIn() param -- without this override, the sign-up
// form's name field would never reach the users table (see Settings' Team
// tab, which needs a real name to display instead of falling back to a
// confusing "pending sign-up" string for every password-auth user).
const PasswordWithName = Password({
  profile(params) {
    const name = typeof params.name === "string" ? params.name.trim() : "";
    return {
      email: params.email as string,
      ...(name ? { name } : {}),
    };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordWithName, Google],
  callbacks: {
    // Spec Sec3: "Owner creates the second user directly. No invitation flow
    // in V1." The first person to ever sign up (via either provider) is
    // that owner; anyone signing up after that starts with no role until
    // the owner assigns one via users.setRole.
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      if (existingUserId !== null) return; // existing user signing back in
      await ctx.runMutation(internal.users.bootstrapFirstOwner, { userId });
    },
  },
});
