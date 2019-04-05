import axios from "../axios";
import { state as configState } from "./config";
import * as Promise from 'bluebird';

const state = {
  accounts: {},
  loading: false,
  loaded: false,
  error: {}
};

const actions = {
  async fetchAccount({ commit, dispatch, rootState }, address) {
    commit("setAccountLoading", true);
    commit("setError", {});
    try {
      let newAccount = {}

      let url = `${configState.lcd}/auth/accounts/${address}`;
      let json = await axios.get(url);

      newAccount = json.data.value;

      url = `${configState.lcd}/staking/delegators/${address}/delegations`;
      json = await axios.get(url);

      newAccount.delegations = json.data

      Promise.map(newAccount.delegations, async delegation => {
        const res = await axios.get(`${configState.lcd}/distribution/delegators/${delegation.delegator_addr}/rewards/${delegation.validator_addr}`);
        delegation.rewards = res.data
      })


      const txs = await Promise.all([
        axios.get(`${configState.lcd}/txs?sender=${address}`),
        axios.get(`${configState.lcd}/txs?recipient=${address}`)
      ]).then(
        async ([senderTxs, recipientTxs]) =>
          await [].concat(senderTxs.data, recipientTxs.data)
      )

      newAccount.txs = txs

      const len = txs.length || 0;
      const promiseArr = []

      for (let i = 0; i < len; i++) {
        if (!rootState.block.blocks[txs[i].height]) {
          await promiseArr.push(dispatch("fetchBlock", txs[i].height))
        }
      }

      await Promise.all(promiseArr)

      commit("updateAccount", {
        address,
        newAccount
      })

      commit("setAccountLoaded", true);
      commit("setAccountLoading", false);
    } catch (error) {
      console.log(error)
      commit("setError", error);
      commit("setAccountLoading", false);
    }
  }
};

const mutations = {
  updateAccount(state, { address, newAccount }) {
    state.accounts = { ...state.accounts, [address]: newAccount };
  },
  setAccountLoaded(state, flag) {
    state.loaded = flag
  },
  setAccountLoading(state, flag) {
    state.loading = flag
  },
  setError(state, error) {
    state.error = error
  }
};

export default {
  state,
  actions,
  mutations
};
