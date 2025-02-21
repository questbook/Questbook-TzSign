import { DefaultContractType, Signer, TezosToolkit } from '@taquito/taquito';
import { TzSignAPI } from './tzSignAPI';


export class TzSign {
    private tezos: TezosToolkit;
    private api: TzSignAPI;
    private contract: DefaultContractType | undefined;
    private latestTxId: string | undefined;

    constructor(tezos: TezosToolkit, api: TzSignAPI, contract?: any) {
        this.tezos = tezos;
        this.api = api;
        this.contract = contract;
    }

    public async createMultiSig(
        owners: string[],
        threshold: string,
        balance: number = 0
    ) {
        try {
            const resCode = await this.api.getContractCode();
            const code = resCode.data;

            const origination = await this.tezos.contract.originate({
                code: code,
                storage: {
                    counter: 0,
                    threshold: Number(threshold),
                    keys: owners
                },
                balance: balance.toString(),
            });
            await origination.confirmation();
            this.contract = await origination.contract();
            return this.contract;

        } catch (e) {
            console.log(e);
        }
    }

    public async isValidSafeAddress(contractAddress: string | undefined = this.contract?.address) {
        try {
            const res = await this.api.getInitStorage(contractAddress!);
            return res.status === 200;
        } catch (e) {
            return false;
        }
    }

    public async isOwner(address: string, contractAddress: string | undefined = this.contract?.address) {
        try {
            const res = await this.api.getInitStorage(contractAddress!);
            const owners: Array<any> = res.data.owners;
            return owners.map((owner: any) => owner.address).includes(address);
        } catch (e) {
            console.log(e);
            return false;
        }
    }

    public async createXTZTransaction(
        amount: number,
        destination: string,
        contractAddress: string | undefined = this.contract?.address
    ) {
        try {
            const tx = await this.api.createOperationXTZ(contractAddress!, amount, destination);
            this.latestTxId = tx.operation_id;
            return tx;
        } catch (e) {
            console.log(e);
        }
    }

    public async getTransactionHashStatus(
        transactionHash: string,
        contractAddress: string | undefined = this.contract?.address
    ) {
        try {
            const txs = await this.api.getOperations(contractAddress!);
            return txs.find((tx: any) => tx.operation_id === transactionHash);

        } catch (e) {
            console.log(e)
        }
    }

    public async signTx(
        type: "approve" | "reject",
        contractAddress: string | undefined = this.contract?.address,
        txId: string = this.latestTxId!,
        signer: Signer = this.tezos.signer
    ) {
        try {
            const payloadRes = await this.api.getOperationPayload(txId, type);
            const signature = (await signer.sign(payloadRes.payload, new Uint8Array())).prefixSig;
            const signedRes = await this.api.saveOperationSignature(
                contractAddress!,
                txId,
                await signer.publicKey(),
                signature,
                type
            );
            return signedRes;

        } catch (e) {
            console.log(e);
        }
    }

    public async sendTx(
        type: "approve" | "reject",
        txId: string = this.latestTxId!,
        contractAddress: string | undefined = this.contract?.address,
    ) {
        try {
            let resTx = await this.api.getSignedOperation(type, txId);
            resTx.value = JSON.parse(resTx.value);
            const tx = await this.tezos.wallet.transfer({
                to: contractAddress!,
                amount: 0,
                parameter: resTx
            }).send();
            await tx.confirmation();
            return tx;

        } catch (e) {
            console.log(e);
        }
    }
}