// Server-only: gasless Bubblegum cNFT mint. The fee-payer keypair (which pays + is the tree
// authority) never leaves the server (NFR-3). The cNFT is owned by the user's wallet, so the fan
// pays nothing (FR-A4/M2). Read back via Helius DAS to prove it's real on-chain (FR-M3).

import fs from 'node:fs';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fetchTreeConfigFromSeeds, findLeafAssetIdPda, mintV1, mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { keypairIdentity, none, publicKey, type Umi } from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';

let umi: Umi | null = null;

export function mintConfigured(): boolean {
  return Boolean(process.env.HELIUS_RPC_URL && process.env.FEE_PAYER_KEYPAIR && process.env.BUBBLEGUM_TREE_ADDRESS);
}

function getUmi(): Umi {
  if (umi) return umi;
  const rpc = process.env.HELIUS_RPC_URL as string;
  // Accept the fee-payer key as an inline JSON array (Vercel/Railway env) OR a file path (local).
  const raw = (process.env.FEE_PAYER_KEYPAIR as string).trim();
  const json = raw.startsWith('[') ? raw : fs.readFileSync(raw.replace('~', process.env.HOME ?? ''), 'utf8');
  const secret = new Uint8Array(JSON.parse(json));
  const u = createUmi(rpc).use(mplBubblegum());
  u.use(keypairIdentity(u.eddsa.createKeypairFromSecretKey(secret)));
  umi = u;
  return u;
}

export interface MintInput {
  owner: string;
  level: number;
  rarity: string;
}
export interface MintOutput {
  assetId: string;
  signature: string;
}

const METADATA_URI = (process.env.APP_URL || 'https://sixth-sense.vercel.app') + '/moment-metadata.json';

export async function mintMomentCNFT({ owner, level, rarity }: MintInput): Promise<MintOutput> {
  const u = getUmi();
  const merkleTree = publicKey(process.env.BUBBLEGUM_TREE_ADDRESS as string);
  const { signature } = await mintV1(u, {
    leafOwner: publicKey(owner),
    merkleTree,
    metadata: {
      name: `SIXTH SENSE · ${rarity} Lvl ${level}`,
      uri: METADATA_URI,
      sellerFeeBasisPoints: 0,
      collection: none(),
      creators: [],
    },
  }).sendAndConfirm(u);

  // Derive the assetId from the tree's mint counter — robust vs. flaky tx-log parsing on devnet.
  const treeConfig = await fetchTreeConfigFromSeeds(u, { merkleTree });
  const leafIndex = Number(treeConfig.numMinted) - 1;
  const [assetPk] = findLeafAssetIdPda(u, { merkleTree, leafIndex });
  return { assetId: String(assetPk), signature: base58.deserialize(signature)[0] };
}
