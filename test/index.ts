import * as chai from 'chai';
import * as Arweave from "../src/node";
import { Api } from '../src/arweave/lib/api';
import { Wallets } from '../src/arweave/wallets';
import { Network } from '../src/arweave/network';
import { Transactions } from '../src/arweave/transactions';
import { NodeCryptoDriver } from '../src/arweave/lib/crypto/node-driver';
import { Transaction } from '../src/arweave/lib/transaction';

const expect = chai.expect;

const arweave = Arweave.init({ host: 'arweave.net', port: 1984, logging: false });

const digestRegex = /^[a-z0-9-_]{43}$/i;
const liveAddressBalance = '498557055636';
const liveAddress = '9_666Wkk2GzL0LGd3xhb0jY7HqNy71BaV4sULQlJsBQ';
const liveTxid = 'CE-1SFiXqWUEu0aSTebE6LC0-5JBAc3IAehYGwdF5iI';

const liveDataTxid = 'Ie-fxxzdBweiA0N1ZbzUqXhNI310uDUmaBc3ajlV6YY';

describe('Initialization', function () {
    it('should have components', function () {

        expect(arweave.api).to.be.an.instanceOf(Api);

        expect(arweave.transactions).to.be.an.instanceOf(Transactions);

        expect(arweave.wallets).to.be.an.instanceOf(Wallets);

        expect(arweave.network).to.be.an.instanceOf(Network);

        expect(arweave.crypto).to.be.an.instanceOf(NodeCryptoDriver);

    })
});


describe('Network Info', function () {
    it('should get network info', async function () {

        this.timeout(3000);

        const info = await arweave.network.getInfo();
        const peers = await arweave.network.getPeers();

        expect(info).to.be.an('object')

        expect(Object.keys(info)).to.contain.members(['height', 'current', 'release', 'version', 'blocks']);

        expect(info.height).to.be.a('number').greaterThan(0);

        expect(peers).to.be.an('array');
    })
})

describe('Wallets and keys', function () {

    it('should generate valid JWKs', async function () {

        this.timeout(3000);

        const walletA = await arweave.wallets.generate();
        const walletB = await arweave.wallets.generate();

        expect(walletA).to.be.an('object', 'New wallet is not an object');

        expect(walletA).to.have.all.keys('kty', 'n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi');

        expect(walletA.kty).to.equal('RSA');

        expect(walletA.e).to.equal('AQAB');

        expect(walletA.n).to.match(/^[a-z0-9-_]{683}$/i);

        expect(walletA.d).to.match(/^[a-z0-9-_]{683}$/i);

        const addressA = await arweave.wallets.jwkToAddress(walletA);
        const addressB = await arweave.wallets.jwkToAddress(walletB);

        expect(addressA).to.be.a('string');

        expect(addressA).to.match(digestRegex);

        expect(addressB).to.match(digestRegex);

        expect(addressA).to.not.equal(addressB);

    })

    it('should get wallet info', async function () {

        this.timeout(3000);

        const wallet = await arweave.wallets.generate();

        const address = await arweave.wallets.jwkToAddress(wallet);

        const balance = await arweave.wallets.getBalance(address);

        const lastTx = await arweave.wallets.getLastTransactionID(address);

        expect(balance).to.be.a('string');

        expect(balance).to.equal('0');

        expect(lastTx).to.be.a('string');

        expect(lastTx).to.equal('');

        const balanceB = await arweave.wallets.getBalance(liveAddress);

        const lastTxB = await arweave.wallets.getLastTransactionID(liveAddress);

        expect(balanceB).to.be.a('string');

        expect(balanceB).to.equal(liveAddressBalance);

        expect(lastTxB).to.be.a('string');

        expect(lastTxB).to.equal(liveTxid);
    })


});


describe('Transactions', function () {

    it('should create and sign transactions', async function () {

        this.timeout(3000);

        const wallet = await arweave.wallets.generate();

        const transaction = await arweave.createTransaction({ data: 'test' }, wallet);

        transaction.addTag('test-tag-1', 'test-value-1');
        transaction.addTag('test-tag-2', 'test-value-2');
        transaction.addTag('test-tag-3', 'test-value-3');

        expect(transaction).to.be.an.instanceOf(Transaction);

        expect(transaction.data).to.equal('dGVzdA');

        expect(transaction.last_tx).to.equal('');

        expect(transaction.reward).to.match(/^[0-9]+$/);

        await arweave.transactions.sign(transaction, wallet);

        expect(transaction.signature).to.match(/^[a-z0-9-_]+$/i);

        expect(transaction.id).to.match(digestRegex);

        const verified = await arweave.transactions.verify(transaction)

        expect(verified).to.be.a('boolean');

        expect(verified).to.be.true;

        //@ts-ignore
        // Needs ts-ignoring as tags are readonly so chaning the tag like this isn't 
        // normally an allowed operation, but it's a test, so...
        transaction.tags[1].value = 'dGVzdDI';

        const verifiedWithModififedTags = await arweave.transactions.verify(transaction)

        expect(verifiedWithModififedTags).to.be.a('boolean');

        expect(verifiedWithModififedTags).to.be.false;

    })


    it('should get transaction info', async function () {

        this.timeout(3000);

        const transactionStatus = await arweave.transactions.getStatus(liveDataTxid);
        const transaction = await arweave.transactions.get(liveDataTxid);

        expect(transactionStatus).to.be.a('number');

        expect(transactionStatus).to.equal(200);

        expect(transaction.get('data', { decode: true, string: true })).to.contain('<title>Releases · ArweaveTeam/arweave</title>');

        expect(await arweave.transactions.verify(transaction)).to.be.true;

        transaction.signature = 'xxx';

        const verifyResult = await (() => {
            return new Promise((resolve) => {
                arweave.transactions.verify(transaction).catch(error => {
                    resolve(error);
                })
            })
        })();

        expect(verifyResult).to.be.an.instanceOf(Error).with.property('message').and.match(/^.*invalid transaction signature.*$/i)

    });

    it('should post transactions', async function () {

        this.timeout(3000);

        const wallet = await arweave.wallets.generate();

        const transaction = await arweave.createTransaction({ data: 'test' }, wallet);

        const unsignedResponse = await arweave.transactions.post(transaction);

        expect(unsignedResponse.status).to.be.a('number');

        // Unsigned transactions shouldn't be accepted (current implementation returns 500)
        expect(unsignedResponse.status).to.equal(500);

        await arweave.transactions.sign(transaction, wallet);

        const signedResponse = await arweave.transactions.post(transaction);

        expect(signedResponse.status).to.be.a('number');

        expect(signedResponse.status).to.not.equal(500);
    });

});