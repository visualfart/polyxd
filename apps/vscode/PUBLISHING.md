# Publishing the extension

The release workflow (`.github/workflows/release.yml`, job `vscode`) publishes the extension on every version tag. It goes to two places:

- the **Visual Studio Marketplace**, for VS Code;
- **Open VSX**, for Cursor, VSCodium and Windsurf.

It needs one token for each, saved as a GitHub secret. Until a secret is set, that registry is skipped with a notice and the release stays green. A version a registry already has is skipped too.

Everything below is done once, by the owner, in a browser. Nothing here has been done yet.

## 1. Visual Studio Marketplace

1. **Create an Azure DevOps organisation.** Go to [dev.azure.com](https://dev.azure.com) and sign in with the Microsoft account that will own the extension. Follow [Create an organization](https://learn.microsoft.com/azure/devops/organizations/accounts/create-organization). Any name will do.
2. **Create a Personal Access Token** (only if you don't set up "Publish without a token" below, and only until 1 December 2026). In Azure DevOps, open **User settings → Personal access tokens → New Token**. Set:
   - Name: `polyxd marketplace`
   - Organization: **All accessible organizations**
   - Expiration: the longest it offers
   - Scopes: **Custom defined**, then **Show all scopes**, then **Marketplace → Manage**

   Copy the token. You won't see it again.
3. **Create the `polyxd` publisher.** Go to [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage), signed in with the same Microsoft account. Choose **Create publisher**. Set **ID** to `polyxd` and **Name** to `Polyxd`. The ID can never change. If `polyxd` is taken, stop and tell us: `publisher` in `apps/vscode/package.json` must match the ID you get.
4. **Check the token works** (optional, token route only). In `apps/vscode`, run `npx vsce login polyxd` and paste the token.
5. **Verify polyxd.com for the publisher** (later, see the note). In the publisher's **Details** tab, under **Verified domain**, enter `polyxd.com`. Choose **Save**, then **Verify**. The dialog gives you a DNS TXT record. Add it to polyxd.com's DNS in Cloudflare, then choose **Verify** again. Microsoft reviews it within 5 business days. The listing then shows a verified badge.

   The Marketplace only accepts a domain registered at least 6 months ago, for a publisher that has had extensions published for at least 6 months. polyxd.com was registered on 19 September 2026. So this step can be done from about 19 March 2027, and not before 6 months after the first publish.

### Publish without a token (recommended)

Microsoft retires "All accessible organizations" tokens on **1 December 2026**. After that date, `VSCE_PAT` stops working. The release job already supports the replacement: Microsoft Entra ID sign-in, with no Marketplace token stored anywhere ([Secure automated publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#secure-automated-publishing-to-visual-studio-marketplace)). Set it up once:

1. In the Azure portal, create a **user-assigned managed identity** (any resource group in any subscription; a free subscription is enough). Note its **Client ID**, your **Tenant ID** and the **Subscription ID**.
2. On the identity, open **Federated credentials**, add one for **GitHub Actions deploying Azure resources**, and fill in: organisation `visualfart`, repository `polyxd`, entity **Environment**, environment name `vscode-marketplace`.
3. At [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage), open the `polyxd` publisher, **Members**, and add the managed identity by its resource ID with the **Contributor** role.
4. In GitHub, **Settings → Secrets and variables → Actions → Variables**, add three repository variables (they are identifiers, not secrets): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`.

When `AZURE_CLIENT_ID` is set, the job signs in with the identity and runs `vsce publish --azure-credential`. When it isn't, it falls back to `VSCE_PAT`. The job runs in a GitHub environment called `vscode-marketplace`, which GitHub creates on the first run; you can add required reviewers to it if you want to approve each Marketplace release.

## 2. Open VSX

1. **Create an Eclipse account** at [accounts.eclipse.org](https://accounts.eclipse.org/user/register). Fill in the **GitHub Username** field with the GitHub account you'll use on Open VSX, exactly.
2. **Sign the publisher agreement.** Sign in to [open-vsx.org](https://open-vsx.org) with that GitHub account. On your profile page (**Settings**), choose **Log in with Eclipse**, then read and accept the **Publisher Agreement**.
3. **Create an access token.** In [Settings → Access Tokens](https://open-vsx.org/user-settings/tokens), choose **Generate New Token**, name it `polyxd release`, and copy it.
4. **Create the `polyxd` namespace.** From any terminal: `npx ovsx create-namespace polyxd -p <the token>`. On 28 September 2026 the name was free.
5. **Claim the namespace** (recommended). Open an issue at [EclipseFdn/open-vsx.org](https://github.com/EclipseFdn/open-vsx.org/issues/new/choose) with the namespace ownership template. Once granted, the listing shows as verified and nobody else can publish as `polyxd`.

## 3. Add the two GitHub secrets

In the repository, open **Settings → Secrets and variables → Actions → New repository secret** and add:

| Name | Value |
|---|---|
| `VSCE_PAT` | the Azure DevOps token from step 1.2 |
| `OVSX_PAT` | the Open VSX token from step 2.3 |

Or, from a terminal: `gh secret set VSCE_PAT` and `gh secret set OVSX_PAT` (each asks for the value).

## 4. Release

1. Set `version` in `apps/vscode/package.json` and add a matching `## <version>` section to `apps/vscode/CHANGELOG.md`. The extension's tests fail if the changelog has no entry for the version.
2. Push a version tag, as for any release: `git tag v0.3.1 && git push origin v0.3.1`. The tag must match the npm packages' version (the `publish` job checks that). The extension publishes its own `package.json` version, which can differ.
3. Watch the **Release** run. The `vscode` job says which registries it published to, or why it skipped one.

The `v0.3.0` tag already exists and predates this job, so the first publish comes with the next tag. To publish 0.3.0 before then, run this from the repository root, with the tokens in your shell only:

```sh
npm ci && npm run build -w @polyxd/core && npm run build:preview -w @polyxd/react
npm run package -w polyxd-vscode
cd apps/vscode
VSCE_PAT=… npx vsce publish --packagePath polyxd-vscode-0.3.0.vsix
OVSX_PAT=… npx ovsx publish polyxd-vscode-0.3.0.vsix
```

After the first publish, change "coming to the Marketplace" in `apps/vscode/README.md` and `apps/site/content/docs/vscode.md` to the install links: `https://marketplace.visualstudio.com/items?itemName=polyxd.polyxd-vscode` and `https://open-vsx.org/extension/polyxd/polyxd-vscode`.

## What the job does

`scripts/published.ts` asks both registries whether they have this version (public lookups, no token). `scripts/package.ts` builds the `.vsix` with README images and links pointing at the tag on GitHub, so a published version's page never changes under it. `vsce publish` and `ovsx publish` then upload that one file. Each reads its token from the environment. CI also builds the `.vsix` on every push and pull request and keeps it as the `polyxd-vscode` artifact for a week.
