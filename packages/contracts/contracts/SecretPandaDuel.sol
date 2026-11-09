// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract SecretPandaDuel is ZamaEthereumConfig {
    enum Phase { WaitingForOpponent, WaitingForMoves, WaitingForResult, Completed, Cancelled, Expired }
    enum Result { Draw, PlayerAWins, PlayerBWins, InvalidMove }

    uint64 public constant JOIN_WINDOW = 30 minutes;
    uint64 public constant MOVE_WINDOW = 15 minutes;
    uint256 public constant HISTORY_LIMIT = 20;

    struct Room {
        address playerA;
        uint64 createdAt;
        Phase phase;
        Result result;
        bool submittedA;
        bool submittedB;
        address playerB;
        uint64 joinDeadline;
        address invitedOpponent;
        uint64 moveDeadline;
        uint64 endedAt;
        euint8 encryptedResult;
        uint256 rematchId;
    }

    struct Stats {
        uint256 wins;
        uint256 losses;
        uint256 draws;
    }

    error RoomNotFound();
    error WrongPhase();
    error NotParticipant();
    error NotCreator();
    error CannotJoin();
    error DeadlinePassed();
    error DeadlinePending();
    error AlreadySubmitted();
    error InputAlreadyUsed();
    error MissingInputProof();
    error RematchExists();
    error InvalidResult();
    error PageTooLarge();

    event RoomCreated(uint256 indexed roomId, address indexed playerA, address indexed invitedOpponent);
    event RoomJoined(uint256 indexed roomId, address indexed playerB);
    event MoveSubmitted(uint256 indexed roomId, address indexed player);
    event ResultReady(uint256 indexed roomId, bytes32 resultHandle);
    event RoundFinalized(uint256 indexed roomId, address indexed playerA, address indexed playerB, Result result);
    event RoomCancelled(uint256 indexed roomId);
    event RoomExpired(uint256 indexed roomId);
    event RematchCreated(uint256 indexed previousRoomId, uint256 indexed roomId);

    uint256 public roomCount;
    mapping(uint256 => Room) private rooms;
    mapping(uint256 => euint8) private firstMoves;
    mapping(bytes32 => bool) private usedInputs;
    mapping(address => Stats) private stats;
    mapping(address => uint256[]) private completedRooms;

    function createRoom() external returns (uint256) {
        return _createRoom(address(0));
    }

    function createRematch(uint256 roomId) external returns (uint256 nextId) {
        Room storage room = _room(roomId);
        if (room.phase != Phase.Completed) revert WrongPhase();
        if (msg.sender != room.playerA && msg.sender != room.playerB) revert NotParticipant();
        if (room.rematchId != 0) revert RematchExists();

        address opponent = msg.sender == room.playerA ? room.playerB : room.playerA;
        nextId = _createRoom(opponent);
        room.rematchId = nextId;
        emit RematchCreated(roomId, nextId);
    }

    function joinRoom(uint256 roomId) external {
        Room storage room = _room(roomId);
        if (room.phase != Phase.WaitingForOpponent) revert WrongPhase();
        if (block.timestamp >= room.joinDeadline) revert DeadlinePassed();
        if (msg.sender == room.playerA) revert CannotJoin();
        if (room.invitedOpponent != address(0) && msg.sender != room.invitedOpponent) revert CannotJoin();

        room.playerB = msg.sender;
        room.moveDeadline = uint64(block.timestamp) + MOVE_WINDOW;
        room.phase = Phase.WaitingForMoves;
        emit RoomJoined(roomId, msg.sender);
    }

    function submitMove(uint256 roomId, externalEuint8 encryptedMove, bytes calldata inputProof) external {
        Room storage room = _room(roomId);
        if (room.phase != Phase.WaitingForMoves) revert WrongPhase();
        if (block.timestamp >= room.moveDeadline) revert DeadlinePassed();

        bool isA = msg.sender == room.playerA;
        if (!isA && msg.sender != room.playerB) revert NotParticipant();
        if (isA ? room.submittedA : room.submittedB) revert AlreadySubmitted();
        if (inputProof.length == 0) revert MissingInputProof();

        bytes32 inputHandle = externalEuint8.unwrap(encryptedMove);
        if (usedInputs[inputHandle]) revert InputAlreadyUsed();
        euint8 move = FHE.fromExternal(encryptedMove, inputProof);
        usedInputs[inputHandle] = true;

        if (isA) room.submittedA = true;
        else room.submittedB = true;
        emit MoveSubmitted(roomId, msg.sender);

        if (!room.submittedA || !room.submittedB) {
            firstMoves[roomId] = move;
            FHE.allowThis(move);
            return;
        }

        euint8 first = firstMoves[roomId];
        firstMoves[roomId] = euint8.wrap(bytes32(0));
        euint8 outcome = isA ? _evaluate(move, first) : _evaluate(first, move);
        room.encryptedResult = outcome;
        room.phase = Phase.WaitingForResult;
        FHE.makePubliclyDecryptable(outcome);
        emit ResultReady(roomId, euint8.unwrap(outcome));
    }

    function finalizeRound(uint256 roomId, uint8 outcome, bytes calldata proof) external {
        Room storage room = _room(roomId);
        if (room.phase != Phase.WaitingForResult) revert WrongPhase();
        if (outcome > uint8(Result.InvalidMove)) revert InvalidResult();

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint8.unwrap(room.encryptedResult);
        FHE.checkSignatures(handles, abi.encode(outcome), proof);

        Result result = Result(outcome);
        room.result = result;
        room.phase = Phase.Completed;
        room.endedAt = uint64(block.timestamp);
        completedRooms[room.playerA].push(roomId);
        completedRooms[room.playerB].push(roomId);
        if (result == Result.Draw) {
            stats[room.playerA].draws++;
            stats[room.playerB].draws++;
        } else if (result == Result.PlayerAWins) {
            stats[room.playerA].wins++;
            stats[room.playerB].losses++;
        } else if (result == Result.PlayerBWins) {
            stats[room.playerB].wins++;
            stats[room.playerA].losses++;
        }
        emit RoundFinalized(roomId, room.playerA, room.playerB, result);
    }

    function cancelRoom(uint256 roomId) external {
        Room storage room = _room(roomId);
        if (room.phase != Phase.WaitingForOpponent) revert WrongPhase();
        if (msg.sender != room.playerA) revert NotCreator();
        if (block.timestamp >= room.joinDeadline) revert DeadlinePassed();

        room.phase = Phase.Cancelled;
        room.endedAt = uint64(block.timestamp);
        emit RoomCancelled(roomId);
    }

    function expireRoom(uint256 roomId) external {
        Room storage room = _room(roomId);
        uint64 deadline;
        if (room.phase == Phase.WaitingForOpponent) deadline = room.joinDeadline;
        else if (room.phase == Phase.WaitingForMoves) deadline = room.moveDeadline;
        else revert WrongPhase();
        if (block.timestamp < deadline) revert DeadlinePending();

        firstMoves[roomId] = euint8.wrap(bytes32(0));
        room.phase = Phase.Expired;
        room.endedAt = uint64(block.timestamp);
        emit RoomExpired(roomId);
    }

    function getRoom(uint256 roomId) external view returns (Room memory) {
        return _room(roomId);
    }

    function getPlayerStats(address player) external view returns (Stats memory) {
        return stats[player];
    }

    function getRecentMatches(address player, uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        if (limit > HISTORY_LIMIT) revert PageTooLarge();

        uint256[] storage history = completedRooms[player];
        uint256 end = history.length;
        if (offset >= end) return new uint256[](0);
        end -= offset;
        uint256 count = limit < end ? limit : end;
        ids = new uint256[](count);
        for (uint256 i; i < count; ++i) ids[i] = history[end - 1 - i];
    }

    function _createRoom(address opponent) private returns (uint256 roomId) {
        roomId = ++roomCount;
        Room storage room = rooms[roomId];
        room.playerA = msg.sender;
        room.invitedOpponent = opponent;
        room.createdAt = uint64(block.timestamp);
        room.joinDeadline = room.createdAt + JOIN_WINDOW;
        emit RoomCreated(roomId, msg.sender, opponent);
    }

    function _room(uint256 roomId) private view returns (Room storage room) {
        room = rooms[roomId];
        if (room.playerA == address(0)) revert RoomNotFound();
    }

    function _evaluate(euint8 a, euint8 b) private returns (euint8) {
        ebool valid = FHE.and(FHE.le(a, uint8(2)), FHE.le(b, uint8(2)));
        // With valid inputs, A wins when (a - b) is 1 or -2. euint8 wraps -2 to 254.
        euint8 difference = FHE.sub(a, b);
        ebool aWins = FHE.or(FHE.eq(difference, uint8(1)), FHE.eq(difference, uint8(254)));
        euint8 winner = FHE.select(aWins, FHE.asEuint8(1), FHE.asEuint8(2));
        euint8 result = FHE.select(FHE.eq(difference, uint8(0)), FHE.asEuint8(0), winner);
        return FHE.select(valid, result, FHE.asEuint8(3));
    }
}
